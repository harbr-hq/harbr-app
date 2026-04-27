mod config;
mod daemon;
mod db;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tokio_util::sync::CancellationToken;

// ─── Managed state ──────────────────────────────────────────────────────────

/// Newtype wrapper so Tauri's state system can hold the auth token.
struct AppToken(String);

/// Whether closing the window hides to tray (true) or quits the app (false).
struct CloseToPref(Arc<AtomicBool>);

/// Whether OS system notifications are enabled.
struct NotificationsPref(Arc<AtomicBool>);

/// Shutdown token — cancel this to trigger graceful daemon shutdown.
struct ShutdownToken(CancellationToken);

// ─── Preferences persistence ─────────────────────────────────────────────────

fn prefs_path() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("harbr")
        .join("prefs.json")
}

fn load_close_to_tray() -> bool {
    std::fs::read_to_string(prefs_path())
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.get("close_to_tray").and_then(|v| v.as_bool()))
        .unwrap_or(true) // default: close to tray
}

/// Read prefs, set `key` to `value`, write back — additive, never clobbers other keys.
fn save_pref(key: &str, value: bool) {
    let path = prefs_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut prefs: serde_json::Map<String, serde_json::Value> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    prefs.insert(key.to_string(), serde_json::Value::Bool(value));
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&prefs).unwrap());
}

fn save_close_to_tray(value: bool) {
    save_pref("close_to_tray", value);
}

fn load_notifications_enabled() -> bool {
    std::fs::read_to_string(prefs_path())
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.get("notifications_enabled").and_then(|v| v.as_bool()))
        .unwrap_or(true) // default: enabled
}

fn save_notifications_enabled(value: bool) {
    save_pref("notifications_enabled", value);
}

// ─── IPC commands ────────────────────────────────────────────────────────────

/// Returns the auth token to the frontend for API/WebSocket auth.
#[tauri::command]
fn get_token(state: tauri::State<AppToken>) -> String {
    state.0.clone()
}

/// Open a file or directory with the default system application.
#[tauri::command]
fn open_file_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Copy a file from source to destination for the volume file browser.
#[tauri::command]
fn save_file_as(source: String, destination: String) -> Result<(), String> {
    std::fs::copy(&source, &destination)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Returns whether closing the window hides to tray.
#[tauri::command]
fn get_close_to_tray(state: tauri::State<CloseToPref>) -> bool {
    state.0.load(Ordering::Relaxed)
}

/// Sets the close-to-tray preference and persists it to disk.
#[tauri::command]
fn set_close_to_tray(value: bool, state: tauri::State<CloseToPref>) {
    state.0.store(value, Ordering::Relaxed);
    save_close_to_tray(value);
}

/// Returns whether system notifications are enabled.
#[tauri::command]
fn get_notifications_enabled(state: tauri::State<NotificationsPref>) -> bool {
    state.0.load(Ordering::Relaxed)
}

/// Sets the system notifications preference and persists it to disk.
#[tauri::command]
fn set_notifications_enabled(value: bool, state: tauri::State<NotificationsPref>) {
    state.0.store(value, Ordering::Relaxed);
    save_notifications_enabled(value);
}

#[tauri::command]
fn check_dir_exists(path: String) -> bool {
    std::fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false)
}

// ─── System tray — data types ────────────────────────────────────────────────

#[derive(serde::Deserialize, Clone, PartialEq)]
struct TrayContainer {
    id: String,
    name: String,
    /// Serialised ContainerStatus: "running" | "stopped" | "paused" | "exited" | "unknown"
    status: String,
    /// Exposed port bindings, e.g. ["0.0.0.0:8080->80/tcp"]
    ports: Vec<String>,
}

#[derive(serde::Deserialize, Clone, PartialEq)]
struct TrayProject {
    name: String,
    /// Serialised ComposeStatus: "running" | "partial" | "stopped" | "file_only"
    status: String,
}

const DAEMON_BASE: &str = "http://127.0.0.1:9090/api/v1";
const TRAY_POLL_SECS: u64 = 10;

/// Keeps the last-built tray `Menu` alive so the platform doesn't free it
/// after `set_menu` is called.
struct TrayMenuHolder(std::sync::Mutex<Option<Menu<tauri::Wry>>>);

/// Cached container/compose state from the last successful poll.
/// The menu is only rebuilt when this data actually changes, so a background
/// poll never resets a submenu the user is currently browsing.
struct TrayDataCache {
    containers: std::sync::Mutex<Vec<TrayContainer>>,
    projects: std::sync::Mutex<Vec<TrayProject>>,
    /// True when the last poll reached the daemon successfully.
    daemon_online: std::sync::atomic::AtomicBool,
    /// False until the first successful poll — ensures the menu is built at
    /// least once even if there are zero containers.
    initialized: std::sync::atomic::AtomicBool,
}

// ─── System tray — menu builder ──────────────────────────────────────────────

fn build_tray_menu(
    app: &tauri::AppHandle,
    containers: &[TrayContainer],
    projects: &[TrayProject],
    daemon_online: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
    // ─ Fixed items ────────────────────────────────────────────────────────────
    let health_label = if daemon_online {
        "🟢 Connected"
    } else {
        "🔴 Daemon offline"
    };
    let health = MenuItem::with_id(app, "health", health_label, false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Harbr", true, None::<&str>)?;
    let prefs = MenuItem::with_id(app, "preferences", "Preferences", true, None::<&str>)?;
    let logs = MenuItem::with_id(app, "logs", "View Logs →", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;

    // ─ Containers submenu ─────────────────────────────────────────────────────
    let running_count = containers.iter().filter(|c| c.status == "running").count();
    let c_label = if running_count == 0 {
        format!("Containers — {} stopped", containers.len())
    } else {
        format!("Containers — {} running", running_count)
    };

    // Running containers get ⏹ Stop + ↺ Restart; stopped get ▶ Start.
    let c_action_items: Vec<MenuItem<tauri::Wry>> = containers
        .iter()
        .flat_map(|c| {
            if c.status == "running" {
                vec![
                    MenuItem::with_id(
                        app,
                        format!("stop:{}", c.id),
                        format!("⏹  Stop  {}", c.name),
                        true,
                        None::<&str>,
                    ),
                    MenuItem::with_id(
                        app,
                        format!("restart:{}", c.id),
                        format!("↺  Restart  {}", c.name),
                        true,
                        None::<&str>,
                    ),
                ]
            } else {
                vec![MenuItem::with_id(
                    app,
                    format!("start:{}", c.id),
                    format!("▶  Start  {}", c.name),
                    true,
                    None::<&str>,
                )]
            }
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    let stop_all = MenuItem::with_id(
        app,
        "stop-all",
        "Stop all running",
        running_count > 0,
        None::<&str>,
    )?;
    let c_sep = PredefinedMenuItem::separator(app)?;

    // Placeholder kept in scope so the ref inside the if branch is valid.
    let c_placeholder =
        MenuItem::with_id(app, "no-containers", "No containers", false, None::<&str>)?;
    let containers_sub = if c_action_items.is_empty() {
        Submenu::with_items(
            app,
            "Containers",
            true,
            &[&c_placeholder as &dyn IsMenuItem<_>],
        )?
    } else {
        let mut refs: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![&stop_all as _, &c_sep as _];
        refs.extend(
            c_action_items
                .iter()
                .map(|i| i as &dyn IsMenuItem<tauri::Wry>),
        );
        Submenu::with_items(app, c_label, true, &refs)?
    };

    // ─ Port-copy items (running containers with port bindings) ────────────────
    // One item per binding: "  8080→80  nginx" — clicking copies the host port.
    let port_items: Vec<MenuItem<tauri::Wry>> = containers
        .iter()
        .filter(|c| c.status == "running" && !c.ports.is_empty())
        .flat_map(|c| {
            c.ports.iter().map(move |raw| {
                let short = shorten_port(raw);
                let label = format!("  {}  {}", short, c.name);
                // Extract host port for the copy action.
                let host_port = raw.split("->").next().unwrap_or(raw);
                let host_port = host_port
                    .rsplit(':')
                    .next()
                    .unwrap_or(host_port)
                    .to_string();
                let id = format!("copy-port:{host_port}");
                MenuItem::with_id(app, id, label, true, None::<&str>)
            })
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    // ─ Compose submenu ────────────────────────────────────────────────────────
    let project_action_vecs: Vec<Vec<MenuItem<tauri::Wry>>> = projects
        .iter()
        .map(|p| {
            let mut actions = vec![];
            if p.status != "running" {
                actions.push(MenuItem::with_id(
                    app,
                    format!("compose:up:{}", p.name),
                    "Up",
                    true,
                    None::<&str>,
                )?);
            }
            if p.status == "running" || p.status == "partial" {
                actions.push(MenuItem::with_id(
                    app,
                    format!("compose:down:{}", p.name),
                    "Down",
                    true,
                    None::<&str>,
                )?);
                actions.push(MenuItem::with_id(
                    app,
                    format!("compose:restart:{}", p.name),
                    "Restart",
                    true,
                    None::<&str>,
                )?);
            }
            Ok::<_, tauri::Error>(actions)
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    let project_noops: Vec<MenuItem<tauri::Wry>> = projects
        .iter()
        .map(|p| {
            MenuItem::with_id(
                app,
                format!("compose:noop:{}", p.name),
                "No actions",
                false,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    let project_subs: Vec<Submenu<tauri::Wry>> = projects
        .iter()
        .zip(project_action_vecs.iter())
        .zip(project_noops.iter())
        .map(|((p, actions), noop)| {
            let status_str = match p.status.as_str() {
                "running" => "running",
                "partial" => "partial",
                "stopped" => "stopped",
                _ => "file only",
            };
            let label = format!("{} · {}", p.name, status_str);
            let refs: Vec<&dyn IsMenuItem<tauri::Wry>> = if actions.is_empty() {
                vec![noop as _]
            } else {
                actions.iter().map(|a| a as _).collect()
            };
            Submenu::with_items(app, label, true, &refs)
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    let no_compose = MenuItem::with_id(app, "no-compose", "No projects", false, None::<&str>)?;
    let compose_sub = if project_subs.is_empty() {
        Submenu::with_items(app, "Compose", true, &[&no_compose as &dyn IsMenuItem<_>])?
    } else {
        let refs: Vec<&dyn IsMenuItem<tauri::Wry>> = project_subs.iter().map(|s| s as _).collect();
        Submenu::with_items(app, "Compose", true, &refs)?
    };

    // ─ Assemble ───────────────────────────────────────────────────────────────
    let mut top: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![
        &health,
        &open,
        &prefs,
        &logs,
        &sep1 as _,
        &containers_sub as _,
        &compose_sub as _,
    ];

    // Port-copy block — only shown when there are running containers with ports.
    if !port_items.is_empty() {
        top.push(&sep2 as _);
        for item in &port_items {
            top.push(item as _);
        }
    }

    top.push(&sep3 as _);
    top.push(&quit);

    Menu::with_items(app, &top)
}

// ─── System tray — action dispatcher ─────────────────────────────────────────

/// Fires an OS notification via notify-send, if notifications are enabled.
fn tray_notify(app: &tauri::AppHandle, title: &str, body: &str) {
    let enabled = app
        .try_state::<NotificationsPref>()
        .map(|p| p.0.load(Ordering::Relaxed))
        .unwrap_or(true);
    if !enabled {
        return;
    }
    if let Err(e) = std::process::Command::new("notify-send")
        .args(["--app-name", "Harbr", title, body])
        .spawn()
    {
        tracing::warn!("notify-send unavailable: {e}");
    }
}

/// Looks up a container's display name from the tray data cache by ID.
/// Falls back to the first 8 chars of the ID if not found.
fn container_name(app: &tauri::AppHandle, id: &str) -> String {
    app.try_state::<TrayDataCache>()
        .and_then(|cache| {
            cache
                .containers
                .lock()
                .ok()
                .and_then(|cs| cs.iter().find(|c| c.id == id).map(|c| c.name.clone()))
        })
        .unwrap_or_else(|| id[..id.len().min(8)].to_string())
}

/// Called from `on_menu_event` for any ID that isn't a static menu item.
/// Fires the appropriate daemon REST call and emits OS notifications for the result.
fn handle_tray_action(id: &str, token: Arc<String>, app: tauri::AppHandle) {
    // Clipboard write is synchronous — handle it before spawning.
    if let Some(port) = id.strip_prefix("copy-port:") {
        match arboard::Clipboard::new() {
            Ok(mut cb) => {
                let _ = cb.set_text(port);
            }
            Err(e) => tracing::warn!("Clipboard unavailable: {e}"),
        }
        return;
    }

    let id = id.to_string();
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let token = token.as_str();

        if let Some(cid) = id.strip_prefix("stop:") {
            let name = container_name(&app, cid);
            let _ = app.emit(
                "container-action",
                serde_json::json!({ "id": cid, "action": "stop" }),
            );
            match client
                .post(format!("{DAEMON_BASE}/containers/{cid}/stop"))
                .bearer_auth(token)
                .send()
                .await
            {
                Ok(r) if r.status().is_success() => {
                    tray_notify(&app, "Container stopped", &name);
                    // The REST handler is fire-and-forget — Podman hasn't finished stopping
                    // yet. Schedule a re-poll so the frontend gets the real state once
                    // Podman transitions the container to exited (~1-3 s).
                    let app_repoll = app.clone();
                    let tok = token.to_string();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                        update_tray_cache(&app_repoll, &reqwest::Client::new(), &tok).await;
                    });
                }
                Ok(r) => {
                    tray_notify(
                        &app,
                        "Failed to stop container",
                        &format!("{name} — HTTP {}", r.status()),
                    );
                }
                Err(e) => {
                    tray_notify(&app, "Failed to stop container", &format!("{name} — {e}"));
                }
            }
        } else if let Some(cid) = id.strip_prefix("start:") {
            let name = container_name(&app, cid);
            let _ = app.emit(
                "container-action",
                serde_json::json!({ "id": cid, "action": "start" }),
            );
            match client
                .post(format!("{DAEMON_BASE}/containers/{cid}/start"))
                .bearer_auth(token)
                .send()
                .await
            {
                Ok(r) if r.status().is_success() => {
                    tray_notify(&app, "Container started", &name);
                    let _ = app.emit("containers-changed", ());
                }
                Ok(r) => {
                    tray_notify(
                        &app,
                        "Failed to start container",
                        &format!("{name} — HTTP {}", r.status()),
                    );
                }
                Err(e) => {
                    tray_notify(&app, "Failed to start container", &format!("{name} — {e}"));
                }
            }
        } else if let Some(cid) = id.strip_prefix("restart:") {
            let name = container_name(&app, cid);
            let _ = app.emit(
                "container-action",
                serde_json::json!({ "id": cid, "action": "restart" }),
            );
            // Stop first (blocks until the container has stopped), then start.
            let stop_ok = client
                .post(format!("{DAEMON_BASE}/containers/{cid}/stop"))
                .bearer_auth(token)
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            if stop_ok {
                match client
                    .post(format!("{DAEMON_BASE}/containers/{cid}/start"))
                    .bearer_auth(token)
                    .send()
                    .await
                {
                    Ok(r) if r.status().is_success() => {
                        tray_notify(&app, "Container restarted", &name);
                        let _ = app.emit("containers-changed", ());
                    }
                    Ok(r) => {
                        tray_notify(
                            &app,
                            "Failed to restart container",
                            &format!("{name} — HTTP {}", r.status()),
                        );
                    }
                    Err(e) => {
                        tray_notify(
                            &app,
                            "Failed to restart container",
                            &format!("{name} — {e}"),
                        );
                    }
                }
            } else {
                tray_notify(
                    &app,
                    "Failed to restart container",
                    &format!("{name} — could not stop"),
                );
            }
        } else if id == "stop-all" {
            match client
                .get(format!("{DAEMON_BASE}/containers"))
                .bearer_auth(token)
                .send()
                .await
            {
                Ok(resp) => {
                    if let Ok(containers) = resp.json::<Vec<TrayContainer>>().await {
                        let running: Vec<_> = containers
                            .into_iter()
                            .filter(|c| c.status == "running")
                            .collect();
                        let count = running.len();
                        let mut failed = 0usize;
                        for c in &running {
                            let _ = app.emit(
                                "container-action",
                                serde_json::json!({ "id": &c.id, "action": "stop" }),
                            );
                            let ok = client
                                .post(format!("{DAEMON_BASE}/containers/{}/stop", c.id))
                                .bearer_auth(token)
                                .send()
                                .await
                                .map(|r| r.status().is_success())
                                .unwrap_or(false);
                            if !ok {
                                failed += 1;
                            }
                        }
                        if failed == 0 {
                            tray_notify(
                                &app,
                                "All containers stopped",
                                &format!(
                                    "{count} container{} stopped",
                                    if count == 1 { "" } else { "s" }
                                ),
                            );
                        } else {
                            tray_notify(
                                &app,
                                "Stop all — partial failure",
                                &format!("{failed} of {count} failed to stop"),
                            );
                        }
                        // Fire-and-forget stops — re-poll after a delay for the real state.
                        let app_repoll = app.clone();
                        let tok = token.to_string();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                            update_tray_cache(&app_repoll, &reqwest::Client::new(), &tok).await;
                        });
                    }
                }
                Err(e) => {
                    tray_notify(
                        &app,
                        "Stop all failed",
                        &format!("Could not reach daemon — {e}"),
                    );
                }
            }
        } else if let Some(name) = id.strip_prefix("compose:up:") {
            let name = name.to_string();
            let _ = app.emit(
                "compose-action",
                serde_json::json!({ "name": name, "action": "up" }),
            );
            match client
                .post(format!("{DAEMON_BASE}/compose/{name}/up"))
                .bearer_auth(token)
                .send()
                .await
            {
                Ok(r) if r.status().is_success() || r.status().as_u16() == 202 => {
                    tray_notify(&app, "Compose up", &format!("Starting {name}…"));
                }
                Ok(r) => {
                    tray_notify(
                        &app,
                        "Compose up failed",
                        &format!("{name} — HTTP {}", r.status()),
                    );
                }
                Err(e) => {
                    tray_notify(&app, "Compose up failed", &format!("{name} — {e}"));
                }
            }
        } else if let Some(name) = id.strip_prefix("compose:down:") {
            let name = name.to_string();
            let _ = app.emit(
                "compose-action",
                serde_json::json!({ "name": name, "action": "down" }),
            );
            match client
                .post(format!("{DAEMON_BASE}/compose/{name}/down"))
                .bearer_auth(token)
                .send()
                .await
            {
                Ok(r) if r.status().is_success() || r.status().as_u16() == 202 => {
                    tray_notify(&app, "Compose down", &format!("Stopping {name}…"));
                }
                Ok(r) => {
                    tray_notify(
                        &app,
                        "Compose down failed",
                        &format!("{name} — HTTP {}", r.status()),
                    );
                }
                Err(e) => {
                    tray_notify(&app, "Compose down failed", &format!("{name} — {e}"));
                }
            }
        } else if let Some(name) = id.strip_prefix("compose:restart:") {
            let name = name.to_string();
            let _ = app.emit(
                "compose-action",
                serde_json::json!({ "name": name, "action": "restart" }),
            );
            match client
                .post(format!("{DAEMON_BASE}/compose/{name}/restart"))
                .bearer_auth(token)
                .send()
                .await
            {
                Ok(r) if r.status().is_success() || r.status().as_u16() == 202 => {
                    tray_notify(&app, "Compose restart", &format!("Restarting {name}…"));
                }
                Ok(r) => {
                    tray_notify(
                        &app,
                        "Compose restart failed",
                        &format!("{name} — HTTP {}", r.status()),
                    );
                }
                Err(e) => {
                    tray_notify(&app, "Compose restart failed", &format!("{name} — {e}"));
                }
            }
        }
    });
}

// ─── System tray — polling loop ───────────────────────────────────────────────

/// Strips IP and protocol from a Podman port binding for compact display.
/// "0.0.0.0:8080->80/tcp"  →  "8080→80"
/// "127.0.0.1:443->443/tcp" →  "443→443"
fn shorten_port(raw: &str) -> String {
    // Take the host:port side (before "->"), strip the IP prefix.
    let host_side = raw.split("->").next().unwrap_or(raw);
    let host_port = host_side.rsplit(':').next().unwrap_or(host_side);

    // Take the container-port side (after "->"), strip the protocol suffix.
    let container_side = raw.split("->").nth(1).unwrap_or("");
    let container_port = container_side.split('/').next().unwrap_or(container_side);

    if container_port.is_empty() {
        host_port.to_string()
    } else {
        format!("{host_port}→{container_port}")
    }
}

/// Returns `None` when the daemon is unreachable; `Some(vec)` (possibly empty) otherwise.
async fn fetch_tray_containers(
    client: &reqwest::Client,
    token: &str,
) -> Option<Vec<TrayContainer>> {
    match client
        .get(format!("{DAEMON_BASE}/containers"))
        .bearer_auth(token)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json::<Vec<TrayContainer>>().await.ok(),
        Ok(_) => Some(vec![]), // daemon up, non-200
        Err(_) => None,        // daemon unreachable
    }
}

/// Returns `None` when the daemon is unreachable; `Some(vec)` (possibly empty) otherwise.
async fn fetch_tray_projects(client: &reqwest::Client, token: &str) -> Option<Vec<TrayProject>> {
    match client
        .get(format!("{DAEMON_BASE}/compose"))
        .bearer_auth(token)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json::<Vec<TrayProject>>().await.ok(),
        Ok(_) => Some(vec![]),
        Err(_) => None,
    }
}

/// Polls for fresh data and rebuilds the tray menu only if something changed.
/// A no-change poll is a no-op — the open submenu is never interrupted.
async fn update_tray_cache(app: &tauri::AppHandle, client: &reqwest::Client, token: &str) {
    let new_containers_opt = fetch_tray_containers(client, token).await;
    let new_projects_opt = fetch_tray_projects(client, token).await;

    let online = new_containers_opt.is_some();
    let new_containers = new_containers_opt.unwrap_or_default();
    let new_projects = new_projects_opt.unwrap_or_default();

    let running_count = new_containers
        .iter()
        .filter(|c| c.status == "running")
        .count();
    let tooltip = if !online {
        "Harbr — daemon offline".to_string()
    } else if running_count == 0 {
        "Harbr".to_string()
    } else {
        format!("Harbr — {} running", running_count)
    };

    // Check whether anything actually changed since the last poll.
    let needs_rebuild = if let Some(cache) = app.try_state::<TrayDataCache>() {
        let was_initialized = cache.initialized.load(std::sync::atomic::Ordering::Relaxed);
        let was_online = cache
            .daemon_online
            .load(std::sync::atomic::Ordering::Relaxed);
        let old_containers = cache.containers.lock().unwrap().clone();
        let c_changed = old_containers != new_containers;
        let p_changed = *cache.projects.lock().unwrap() != new_projects;
        let online_changed = was_online != online;

        // Crash detection — fire a notification when a running container becomes exited.
        // Only active after the first successful poll so we don't alert on startup state.
        if was_initialized && was_online && online {
            for old_c in &old_containers {
                if old_c.status == "running" {
                    let now_exited = new_containers
                        .iter()
                        .find(|c| c.id == old_c.id)
                        .is_some_and(|c| c.status == "exited");
                    if now_exited {
                        tray_notify(
                            app,
                            "Container stopped",
                            &format!("{} has exited", old_c.name),
                        );
                    }
                }
            }
        }

        // Commit new values.
        *cache.containers.lock().unwrap() = new_containers.clone();
        *cache.projects.lock().unwrap() = new_projects.clone();
        cache
            .daemon_online
            .store(online, std::sync::atomic::Ordering::Relaxed);
        cache
            .initialized
            .store(true, std::sync::atomic::Ordering::Relaxed);

        // Notify the frontend when container state actually changed.
        if (c_changed || p_changed) && online {
            let _ = app.emit("containers-changed", ());
            if p_changed {
                let _ = app.emit("compose-changed", ());
            }
        }

        !was_initialized || c_changed || p_changed || online_changed
    } else {
        false
    };

    // Tooltip is always safe to update — it doesn't disturb the open menu.
    if let Some(tray) = app.tray_by_id("harbr") {
        let _ = tray.set_tooltip(Some(tooltip));
    }

    if !needs_rebuild {
        return;
    }

    // Something changed — rebuild and apply on the GTK main thread.
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let (containers, projects, daemon_online) =
            if let Some(cache) = app2.try_state::<TrayDataCache>() {
                (
                    cache.containers.lock().unwrap().clone(),
                    cache.projects.lock().unwrap().clone(),
                    cache
                        .daemon_online
                        .load(std::sync::atomic::Ordering::Relaxed),
                )
            } else {
                return;
            };

        match build_tray_menu(&app2, &containers, &projects, daemon_online) {
            Ok(menu) => {
                if let Some(tray) = app2.tray_by_id("harbr") {
                    let _ = tray.set_menu(Some(menu.clone()));
                }
                if let Some(holder) = app2.try_state::<TrayMenuHolder>() {
                    if let Ok(mut guard) = holder.0.lock() {
                        *guard = Some(menu);
                    }
                }
            }
            Err(e) => tracing::error!("Failed to build tray menu: {e}"),
        }
    });
}

async fn tray_menu_loop(app: tauri::AppHandle, token: Arc<String>) {
    let client = reqwest::Client::new();

    // Wait for the daemon to be ready before first poll.
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let ready = client
            .get(format!("{DAEMON_BASE}/info"))
            .bearer_auth(token.as_str())
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        if ready {
            break;
        }
    }

    loop {
        update_tray_cache(&app, &client, token.as_str()).await;
        tokio::time::sleep(std::time::Duration::from_secs(TRAY_POLL_SECS)).await;
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = config::load(None).expect("Failed to load config");

    let log_level = cfg
        .logging
        .level
        .parse::<tracing::Level>()
        .unwrap_or(tracing::Level::INFO);

    tracing_subscriber::fmt().with_max_level(log_level).init();
    let token = daemon::auth::load_or_create_token(&cfg.auth.token_file)
        .expect("Failed to init auth token");

    let close_to_tray = Arc::new(AtomicBool::new(load_close_to_tray()));
    let notifications_enabled = Arc::new(AtomicBool::new(load_notifications_enabled()));

    // Shared token for tray event handler and polling loop.
    let token_arc = Arc::new(token.clone());
    let token_for_events = Arc::clone(&token_arc);
    let token_for_poll = Arc::clone(&token_arc);

    let cfg_clone = cfg.clone();
    let token_for_daemon = token.clone();
    let close_pref_arc = Arc::clone(&close_to_tray);
    let notifications_arc = Arc::clone(&notifications_enabled);
    let shutdown_token = CancellationToken::new();
    let shutdown_for_daemon = shutdown_token.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppToken(token))
        .manage(CloseToPref(close_to_tray))
        .manage(NotificationsPref(notifications_enabled))
        .manage(ShutdownToken(shutdown_token))
        .manage(TrayMenuHolder(std::sync::Mutex::new(None)))
        .manage(TrayDataCache {
            containers: std::sync::Mutex::new(vec![]),
            projects: std::sync::Mutex::new(vec![]),
            daemon_online: std::sync::atomic::AtomicBool::new(false),
            initialized: std::sync::atomic::AtomicBool::new(false),
        })
        .setup(move |app| {
            // ── Daemon ──────────────────────────────────────────────────────
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = daemon::start(
                    cfg_clone,
                    token_for_daemon,
                    shutdown_for_daemon,
                    handle.clone(),
                    notifications_arc,
                )
                .await
                {
                    tracing::error!("Daemon stopped: {e:#}");
                    handle.exit(1);
                }
            });

            // ── System tray ─────────────────────────────────────────────────
            let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let prefs_item =
                MenuItem::with_id(app, "preferences", "Preferences", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &prefs_item, &quit_item])?;

            // Keep the initial menu alive — these locals would otherwise drop when
            // setup() returns, freeing the platform-side GTK menu objects.
            if let Ok(mut guard) = app.state::<TrayMenuHolder>().0.lock() {
                *guard = Some(menu.clone());
            }

            // Explicitly set the window icon so the taskbar shows the correct
            // icon on Linux — Tauri doesn't wire _NET_WM_ICON automatically
            // in dev mode.
            if let (Some(icon), Some(window)) =
                (app.default_window_icon(), app.get_webview_window("main"))
            {
                let _ = window.set_icon(icon.clone());
            }

            TrayIconBuilder::with_id("harbr")
                .icon(
                    app.default_window_icon()
                        .expect("window icon missing — check src-tauri/icons/")
                        .clone(),
                )
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Harbr")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "preferences" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("open-settings", ());
                        }
                    }
                    "logs" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("open-logs", ());
                        }
                    }
                    "quit" => {
                        // Cancel the shutdown token — axum::serve() will exit gracefully,
                        // the log collector will flush, then the daemon calls app.exit(0).
                        app.state::<ShutdownToken>().0.cancel();
                    }
                    id => handle_tray_action(id, Arc::clone(&token_for_events), app.clone()),
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click: show/focus the main window.
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Tray polling loop ────────────────────────────────────────────
            let app_for_poll = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tray_menu_loop(app_for_poll, token_for_poll).await;
            });

            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if close_pref_arc.load(Ordering::Relaxed) {
                    let _ = window.hide();
                    api.prevent_close();
                }
                // else: let the close proceed → app quits
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_token,
            open_file_path,
            save_file_as,
            get_close_to_tray,
            set_close_to_tray,
            get_notifications_enabled,
            set_notifications_enabled,
            check_dir_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
