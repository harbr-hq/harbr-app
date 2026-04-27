use crate::{
    daemon::{AppError, AppState, ComposeBin},
    daemon::routes::containers::crud::ContainerStatus,
    db::compose as db_compose,
};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use bollard::{
    container::LogOutput,
    query_parameters::{ListContainersOptions, LogsOptions, RemoveContainerOptions},
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path as FsPath, PathBuf},
};
use tokio::process::Command;

use super::containers::crud::fetch_containers;

// ─── Response / request types ───────────────────────────────────────────────

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ComposeStatus {
    Running,
    Partial,
    Stopped,
    FileOnly,
}

#[derive(Debug, Serialize, Clone)]
pub struct ComposeService {
    pub name: String,
    pub image: Option<String>,
    pub status: String,
    pub container_id: Option<String>,
    pub ports: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ComposeProject {
    pub name: String,
    pub status: ComposeStatus,
    pub services: Vec<ComposeService>,
    pub file_path: Option<String>,
    pub file_managed: bool,
    pub working_dir: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ComposeFileContent {
    pub content: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CreateComposeBody {
    name: String,
    content: String,
    working_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SaveFileBody {
    content: String,
}

#[derive(Debug, Deserialize)]
struct ValidateBody {
    content: String,
}

#[derive(Debug, Deserialize)]
struct ServiceQuery {
    service: Option<String>,
}

// ─── Router ─────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/compose", get(list_projects).post(create_project))
        .route("/compose/validate", post(validate_file))
        .route(
            "/compose/{name}",
            get(get_project).delete(delete_project),
        )
        .route("/compose/{name}/file", get(get_file).put(save_file))
        .route("/compose/{name}/up", get(op_up_ws).post(op_up_rest))
        .route("/compose/{name}/down", get(op_down_ws).post(op_down_rest))
        .route("/compose/{name}/restart", get(op_restart_ws).post(op_restart_rest))
        .route("/compose/{name}/pull", get(op_pull_ws))
        .route("/compose/{name}/logs", get(project_logs_ws))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Canonical compose file names to scan for.
const COMPOSE_FILENAMES: &[&str] = &[
    "compose.yml",
    "compose.yaml",
    "docker-compose.yml",
    "docker-compose.yaml",
];

/// Walk a directory (one level + subdirs one level) for compose files.
/// Returns a list of (project_name, absolute_path) pairs.
async fn scan_dir_for_compose_files(dir: &FsPath) -> Vec<(String, PathBuf)> {
    let mut results = Vec::new();

    let mut read_dir = match tokio::fs::read_dir(dir).await {
        Ok(r) => r,
        Err(_) => return results,
    };

    while let Ok(Some(entry)) = read_dir.next_entry().await {
        let path = entry.path();
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        if COMPOSE_FILENAMES.iter().any(|n| *n == name_str.as_ref()) {
            // File directly in the scan dir — project name = parent dir name
            let project_name = dir
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "default".to_string());
            results.push((project_name, path));
        } else if path.is_dir() {
            // One level deep — project name = subdir name
            let subdir_name = name_str.into_owned();
            let mut sub_read = match tokio::fs::read_dir(&path).await {
                Ok(r) => r,
                Err(_) => continue,
            };
            let mut found = false;
            while let Ok(Some(sub_entry)) = sub_read.next_entry().await {
                let sub_name = sub_entry.file_name();
                let sub_name_str = sub_name.to_string_lossy();
                if COMPOSE_FILENAMES.iter().any(|n| *n == sub_name_str.as_ref()) {
                    results.push((subdir_name.clone(), sub_entry.path()));
                    found = true;
                    break;
                }
            }
            if !found {
                // Check for compose files named after the subdir itself
                for fname in COMPOSE_FILENAMES {
                    let candidate = path.join(fname);
                    if tokio::fs::metadata(&candidate).await.is_ok() {
                        results.push((subdir_name.clone(), candidate));
                        break;
                    }
                }
            }
        }
    }

    results
}

/// Build the compose command args based on which binary is available.
/// Returns (program, args_prefix) where args_prefix is prepended before the op args.
/// If `working_dir` is set, `--project-directory` is injected so that relative
/// bind mount paths in the compose file resolve from that folder instead of the
/// compose file's own directory.
fn compose_cmd(bin: &ComposeBin, project_name: &str, file_path: &str, working_dir: Option<&str>) -> (String, Vec<String>) {
    // -p overrides any `name:` field in the YAML so container labels always
    // match the Harbr project name regardless of what the file declares.
    let mut prefix = vec!["-p".to_string(), project_name.to_string()];

    if let Some(dir) = working_dir {
        prefix.extend(["--project-directory".to_string(), dir.to_string()]);
    }
    prefix.extend(["-f".to_string(), file_path.to_string()]);

    match bin {
        ComposeBin::Podman => {
            let mut args = vec!["compose".to_string()];
            args.extend(prefix);
            ("podman".to_string(), args)
        }
        ComposeBin::Standalone => {
            ("podman-compose".to_string(), prefix)
        }
    }
}

// ─── REST handlers ───────────────────────────────────────────────────────────

async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<ComposeProject>>, AppError> {
    let projects = build_project_list(&state).await?;
    Ok(Json(projects))
}

async fn build_project_list(state: &AppState) -> anyhow::Result<Vec<ComposeProject>> {
    let containers = fetch_containers(&state.podman).await?;

    // Group running containers by compose project.
    let mut running: HashMap<String, Vec<&crate::daemon::routes::containers::crud::Container>> =
        HashMap::new();
    for c in &containers {
        if let Some(proj) = &c.compose_project {
            running.entry(proj.clone()).or_default().push(c);
        }
    }

    // Gather known file metas from DB.
    let db_metas = db_compose::list_file_metas(&state.db).await?;
    let mut meta_map: HashMap<String, String> = HashMap::new();
    let mut working_dir_map: HashMap<String, Option<String>> = HashMap::new();
    for m in db_metas {
        working_dir_map.insert(m.name.clone(), m.working_dir);
        meta_map.insert(m.name, m.path);
    }

    // Snapshot compose dirs once — the lock is released immediately after clone.
    let compose_dirs = state.compose_dirs.read().map_err(|e| anyhow::anyhow!("State lock poisoned: {e}"))?.clone();

    // Scan compose dirs for files on disk (they may not be in DB yet).
    for dir in &compose_dirs {
        let found = scan_dir_for_compose_files(dir).await;
        for (name, path) in found {
            meta_map
                .entry(name)
                .or_insert_with(|| path.to_string_lossy().into_owned());
        }
    }

    // Merge: start from all project names across running containers + files.
    let mut all_names: std::collections::HashSet<String> = running.keys().cloned().collect();
    all_names.extend(meta_map.keys().cloned());

    let mut projects: Vec<ComposeProject> = all_names
        .into_iter()
        .map(|name| {
            let live_containers = running.get(&name).cloned().unwrap_or_default();
            let file_path = meta_map.get(&name).cloned();
            let file_managed = file_path
                .as_ref()
                .map(|p| {
                    compose_dirs.iter().any(|dir| {
                        FsPath::new(p)
                            .parent()
                            .map(|parent| parent.starts_with(dir) || parent == dir)
                            .unwrap_or(false)
                            || FsPath::new(p).starts_with(dir)
                    })
                })
                .unwrap_or(false);

            let services: Vec<ComposeService> = live_containers
                .iter()
                .map(|c| ComposeService {
                    name: c
                        .compose_service
                        .clone()
                        .unwrap_or_else(|| c.name.clone()),
                    image: Some(c.image.clone()),
                    status: c.status.as_str().to_string(),
                    container_id: Some(c.id.clone()),
                    ports: c.ports.clone(),
                })
                .collect();

            let status = if live_containers.is_empty() {
                if file_path.is_some() {
                    ComposeStatus::FileOnly
                } else {
                    ComposeStatus::Stopped
                }
            } else if live_containers.iter().all(|c| c.status.is_running()) {
                ComposeStatus::Running
            } else if live_containers.iter().any(|c| c.status.is_running()) {
                ComposeStatus::Partial
            } else {
                ComposeStatus::Stopped
            };

            let working_dir = working_dir_map.get(&name).and_then(|d| d.clone());
            ComposeProject {
                name,
                status,
                services,
                file_path,
                file_managed,
                working_dir,
            }
        })
        .collect();

    projects.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(projects)
}

async fn get_project(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ComposeProject>, AppError> {
    let projects = build_project_list(&state).await?;
    projects
        .into_iter()
        .find(|p| p.name == name)
        .map(Json)
        .ok_or_else(|| AppError::not_found(format!("Compose project '{name}' not found")))
}

async fn get_file(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ComposeFileContent>, AppError> {
    let path = resolve_file_path(&name, &state).await?
        .ok_or_else(|| AppError::not_found(format!("No compose file for '{name}'")))?;

    let meta = tokio::fs::metadata(&path).await.map_err(AppError::internal)?;
    if meta.len() > 10 * 1024 * 1024 {
        return Err(AppError::unprocessable("Compose file exceeds 10 MB limit"));
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(AppError::internal)?;

    Ok(Json(ComposeFileContent {
        path: path.to_string_lossy().into_owned(),
        content,
    }))
}

async fn save_file(
    Path(name): Path<String>,
    State(state): State<AppState>,
    Json(body): Json<SaveFileBody>,
) -> Result<StatusCode, AppError> {
    let path = resolve_file_path(&name, &state).await?
        .ok_or_else(|| AppError::not_found(format!("No compose file for '{name}'")))?;

    // Validate before writing.
    let errs = validate_content(&body.content);
    if !errs.is_empty() {
        return Err(AppError::unprocessable(errs.join("; ")));
    }

    tokio::fs::write(&path, &body.content)
        .await
        .map_err(AppError::internal)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn create_project(
    State(state): State<AppState>,
    Json(body): Json<CreateComposeBody>,
) -> Result<Json<ComposeProject>, AppError> {
    let errs = validate_content(&body.content);
    if !errs.is_empty() {
        return Err(AppError::unprocessable(errs.join("; ")));
    }

    if let Some(dir) = &body.working_dir {
        let is_dir = tokio::fs::metadata(dir).await.map(|m| m.is_dir()).unwrap_or(false);
        if !is_dir {
            return Err(AppError::unprocessable(format!("Working directory does not exist or is not a folder: {dir}")));
        }
    }

    // Write to the first configured compose dir.
    let base_dir = state
        .compose_dirs
        .read()
        .map_err(|_| AppError::internal("State lock poisoned"))?
        .first()
        .cloned()
        .ok_or_else(|| AppError::internal("No compose dirs configured"))?;

    let project_dir = base_dir.join(&body.name);
    tokio::fs::create_dir_all(&project_dir)
        .await
        .map_err(AppError::internal)?;

    let file_path = project_dir.join("compose.yml");
    tokio::fs::write(&file_path, &body.content)
        .await
        .map_err(AppError::internal)?;

    let path_str = file_path.to_string_lossy().into_owned();
    db_compose::upsert_file_meta(&state.db, &body.name, &path_str, body.working_dir.as_deref()).await?;

    Ok(Json(ComposeProject {
        name: body.name,
        status: ComposeStatus::FileOnly,
        services: vec![],
        file_path: Some(path_str),
        file_managed: true,
        working_dir: body.working_dir,
    }))
}

async fn delete_project(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    // Bring containers down before removing the file — compose down needs the
    // file to exist to know which containers belong to this project.
    run_op_silent(name.clone(), "down", vec!["down".to_string()], state.clone()).await;

    // Belt-and-suspenders: force-remove any containers still labelled with this
    // project. Handles label-detected projects where compose down had no file,
    // and any containers compose down may have missed.
    force_remove_project_containers(&state.podman, &name).await;

    // Delete the file if it's managed.
    if let Some(path) = resolve_file_path(&name, &state).await? {
        if is_managed_path(&path, &state) {
            let _ = tokio::fs::remove_file(&path).await;
            // Also remove the parent dir if empty.
            if let Some(parent) = path.parent() {
                let _ = tokio::fs::remove_dir(parent).await;
            }
        }
    }
    db_compose::delete_file_meta(&state.db, &name).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Stop and force-remove all containers that carry the `com.docker.compose.project`
/// label matching `project_name`. Best-effort — errors are logged and ignored.
async fn force_remove_project_containers(podman: &bollard::Docker, project_name: &str) {
    let mut filters = HashMap::new();
    filters.insert(
        "label".to_string(),
        vec![format!("com.docker.compose.project={project_name}")],
    );
    let opts = ListContainersOptions {
        all: true,
        filters: Some(filters),
        ..Default::default()
    };
    let containers = match podman.list_containers(Some(opts)).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Could not list containers for project '{project_name}': {e}");
            return;
        }
    };
    for c in containers {
        let Some(id) = c.id else { continue };
        if let Err(e) = podman
            .remove_container(
                &id,
                Some(RemoveContainerOptions { force: true, ..Default::default() }),
            )
            .await
        {
            tracing::warn!("Could not remove container '{id}' for project '{project_name}': {e}");
        }
    }
}

async fn validate_file(
    Json(body): Json<ValidateBody>,
) -> Json<ValidateResult> {
    let errors = validate_content(&body.content);
    Json(ValidateResult {
        valid: errors.is_empty(),
        errors,
    })
}

// ─── Validation ─────────────────────────────────────────────────────────────

fn validate_content(content: &str) -> Vec<String> {
    match serde_yaml::from_str::<serde_yaml::Value>(content) {
        Err(e) => vec![format!("YAML parse error: {e}")],
        Ok(val) => {
            let mut errors = Vec::new();
            if val.get("services").and_then(|s| s.as_mapping()).is_none() {
                errors.push("Missing or invalid 'services' key".to_string());
            } else if let Some(services) = val["services"].as_mapping() {
                for (svc_name, svc_val) in services {
                    let has_image = svc_val.get("image").is_some();
                    let has_build = svc_val.get("build").is_some();
                    if !has_image && !has_build {
                        errors.push(format!(
                            "Service '{}' must have either 'image' or 'build'",
                            svc_name.as_str().unwrap_or("?")
                        ));
                    }
                }
            }
            errors
        }
    }
}

// ─── Path resolution helpers ─────────────────────────────────────────────────

async fn resolve_file_path(name: &str, state: &AppState) -> anyhow::Result<Option<PathBuf>> {
    // Try DB first.
    if let Some(meta) = db_compose::get_file_meta(&state.db, name).await? {
        return Ok(Some(PathBuf::from(meta.path)));
    }
    // Scan dirs.
    let compose_dirs = state.compose_dirs.read().map_err(|e| anyhow::anyhow!("State lock poisoned: {e}"))?.clone();
    for dir in &compose_dirs {
        let found = scan_dir_for_compose_files(dir).await;
        if let Some((_, path)) = found.into_iter().find(|(n, _)| n == name) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

/// Returns the working directory for a project if one was configured.
/// Only DB-tracked projects can have a working directory set.
async fn resolve_working_dir(name: &str, state: &AppState) -> Option<PathBuf> {
    db_compose::get_file_meta(&state.db, name)
        .await
        .ok()
        .flatten()
        .and_then(|m| m.working_dir)
        .map(PathBuf::from)
}

fn is_managed_path(path: &FsPath, state: &AppState) -> bool {
    let Ok(guard) = state.compose_dirs.read() else { return false; };
    guard.iter().any(|dir| path.starts_with(dir))
}

// ─── WS op streaming ────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OpMessage {
    Line { stream: String, line: String },
    Exit { code: i32 },
    Error { message: String },
}

/// Maximum wall-clock time for a compose operation (up/down/pull/restart).
/// If exceeded the WebSocket closes and the child process is killed.
const OP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);

async fn op_ws_handler(
    ws: WebSocketUpgrade,
    name: String,
    op_args: Vec<String>,
    state: AppState,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if tokio::time::timeout(OP_TIMEOUT, run_op(socket, name, op_args, state))
            .await
            .is_err()
        {
            tracing::warn!("Compose operation timed out after {}s", OP_TIMEOUT.as_secs());
        }
    })
}

async fn run_op(mut socket: WebSocket, name: String, op_args: Vec<String>, state: AppState) {
    let bin = match &state.compose_bin {
        Some(b) => b.clone(),
        None => {
            let msg = serde_json::to_string(&OpMessage::Error {
                message: "No compose binary available".to_string(),
            })
            .unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    let file_path = match resolve_file_path(&name, &state).await {
        Ok(Some(p)) => p.to_string_lossy().into_owned(),
        Ok(None) => {
            let msg = serde_json::to_string(&OpMessage::Error {
                message: format!("No compose file found for '{name}'"),
            })
            .unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
        Err(e) => {
            let msg = serde_json::to_string(&OpMessage::Error {
                message: e.to_string(),
            })
            .unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    let working_dir = resolve_working_dir(&name, &state).await;
    let working_dir_str = working_dir.as_deref().and_then(|p| p.to_str());
    let (program, mut args) = compose_cmd(&bin, &name, &file_path, working_dir_str);
    args.extend(op_args);

    let mut child = match Command::new(&program)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let msg = serde_json::to_string(&OpMessage::Error {
                message: format!("Failed to spawn {program}: {e}"),
            })
            .unwrap_or_default();
            let _ = socket.send(Message::Text(msg.into())).await;
            return;
        }
    };

    let stdout = child.stdout.take().map(tokio::io::BufReader::new);
    let stderr = child.stderr.take().map(tokio::io::BufReader::new);

    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(256);

    // Spawn stdout reader.
    if let Some(reader) = stdout {
        let tx2 = tx.clone();
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let msg = serde_json::to_string(&OpMessage::Line {
                    stream: "stdout".to_string(),
                    line,
                })
                .unwrap_or_default();
                if tx2.send(msg).await.is_err() {
                    break;
                }
            }
        });
    }

    // Spawn stderr reader.
    if let Some(reader) = stderr {
        let tx3 = tx.clone();
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let msg = serde_json::to_string(&OpMessage::Line {
                    stream: "stderr".to_string(),
                    line,
                })
                .unwrap_or_default();
                if tx3.send(msg).await.is_err() {
                    break;
                }
            }
        });
    }

    drop(tx); // Drop original sender so channel closes when readers finish.

    // Forward lines to WebSocket, watch for client disconnect.
    loop {
        tokio::select! {
            maybe_msg = rx.recv() => {
                match maybe_msg {
                    Some(msg) => {
                        if socket.send(Message::Text(msg.into())).await.is_err() {
                            // Client disconnected — kill child.
                            let _ = child.kill().await;
                            return;
                        }
                    }
                    None => break, // Both readers finished.
                }
            }
            // Poll for client messages (e.g., close frame).
            ws_msg = socket.recv() => {
                if let Some(Ok(Message::Close(_))) | None = ws_msg {
                    let _ = child.kill().await;
                    return;
                }
            }
        }
    }

    // Wait for exit code.
    let exit_code = child.wait().await.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
    let exit_msg = serde_json::to_string(&OpMessage::Exit { code: exit_code }).unwrap_or_default();
    let _ = socket.send(Message::Text(exit_msg.into())).await;
}

// ─── Fire-and-forget REST handlers (used by system tray) ────────────────────

/// Fires an OS notification via notify-send.
fn compose_notify(title: &str, body: &str) {
    if let Err(e) = std::process::Command::new("notify-send")
        .args(["--app-name", "Harbr", title, body])
        .spawn()
    {
        tracing::warn!("notify-send unavailable: {e}");
    }
}

/// Runs a compose operation in a background task without streaming output.
/// Fires OS notifications on completion or failure (if notifications are enabled).
async fn run_op_silent(name: String, op: &'static str, op_args: Vec<String>, state: AppState) {
    let notifications_on = state.notifications_enabled.load(std::sync::atomic::Ordering::Relaxed);
    let notify = |title: &str, body: &str| {
        if notifications_on {
            compose_notify(title, body);
        }
    };

    let bin = match &state.compose_bin {
        Some(b) => b.clone(),
        None => {
            tracing::warn!("Tray compose op: no binary available");
            notify("Compose failed", &format!("{name} — no compose binary available"));
            return;
        }
    };
    let file_path = match resolve_file_path(&name, &state).await {
        Ok(Some(p)) => p.to_string_lossy().into_owned(),
        Ok(None) => {
            tracing::warn!("Tray compose op: no file found for '{name}'");
            notify("Compose failed", &format!("{name} — compose file not found"));
            return;
        }
        Err(e) => {
            tracing::error!("Tray compose op resolve error: {e:#}");
            notify("Compose failed", &format!("{name} — {e}"));
            return;
        }
    };
    let working_dir = resolve_working_dir(&name, &state).await;
    let working_dir_str = working_dir.as_deref().and_then(|p| p.to_str());
    let (program, mut args) = compose_cmd(&bin, &name, &file_path, working_dir_str);
    args.extend(op_args);
    match Command::new(&program).args(&args).spawn() {
        Ok(mut child) => match child.wait().await {
            Ok(status) if status.success() => {
                let body = match op {
                    "up" => format!("{name} is running"),
                    "down" => format!("{name} is stopped"),
                    _ => format!("{name} restarted"),
                };
                notify(&format!("Compose {op}"), &body);
                use tauri::Emitter;
                let _ = state.app_handle.emit("containers-changed", ());
                let _ = state.app_handle.emit("compose-changed", ());
            }
            Ok(status) => {
                tracing::error!("Tray compose {op} exited with status: {status}");
                notify(
                    &format!("Compose {op} failed"),
                    &format!("{name} — exit code {}", status.code().unwrap_or(-1)),
                );
            }
            Err(e) => {
                tracing::error!("Tray compose {op} wait error: {e}");
                notify(&format!("Compose {op} failed"), &format!("{name} — {e}"));
            }
        },
        Err(e) => {
            tracing::error!("Tray compose {op} spawn failed: {e}");
            notify(&format!("Compose {op} failed"), &format!("{name} — {e}"));
        }
    }
}

async fn op_up_rest(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> StatusCode {
    tokio::spawn(run_op_silent(name, "up", vec!["up".to_string(), "-d".to_string()], state));
    StatusCode::ACCEPTED
}

async fn op_down_rest(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> StatusCode {
    tokio::spawn(run_op_silent(name, "down", vec!["down".to_string()], state));
    StatusCode::ACCEPTED
}

async fn op_restart_rest(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> StatusCode {
    tokio::spawn(run_op_silent(name, "restart", vec!["restart".to_string()], state));
    StatusCode::ACCEPTED
}

async fn op_up_ws(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    op_ws_handler(ws, name, vec!["up".to_string(), "-d".to_string()], state).await
}

async fn op_down_ws(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    op_ws_handler(ws, name, vec!["down".to_string()], state).await
}

async fn op_restart_ws(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    Query(query): Query<ServiceQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut args = vec!["restart".to_string()];
    if let Some(svc) = query.service {
        args.push(svc);
    }
    op_ws_handler(ws, name, args, state).await
}

async fn op_pull_ws(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    op_ws_handler(ws, name, vec!["pull".to_string()], state).await
}

// ─── Compose logs WS ─────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ComposeLogMessage {
    service: String,
    stream: &'static str,
    line: String,
}

async fn project_logs_ws(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| stream_project_logs(socket, name, state))
}

async fn stream_project_logs(mut socket: WebSocket, name: String, state: AppState) {
    let containers = match fetch_containers(&state.podman).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to list containers for compose logs: {e}");
            return;
        }
    };

    let project_containers: Vec<_> = containers
        .into_iter()
        .filter(|c| {
            c.compose_project.as_deref() == Some(&name)
                && matches!(c.status, ContainerStatus::Running)
        })
        .collect();

    if project_containers.is_empty() {
        return;
    }

    // Tell the client the stream is active before sending any log lines.
    // The client uses this to distinguish "connected but compose not running"
    // (server closes immediately, this message never arrives) from "streaming".
    let ready = serde_json::json!({"kind": "ready"}).to_string();
    if socket.send(Message::Text(ready.into())).await.is_err() {
        return;
    }

    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(512);

    for container in project_containers {
        let podman = state.podman.clone();
        let service_name = container
            .compose_service
            .clone()
            .unwrap_or_else(|| container.name.clone());
        let container_id = container.id.clone();
        let tx2 = tx.clone();

        tokio::spawn(async move {
            let opts = LogsOptions {
                follow: true,
                stdout: true,
                stderr: true,
                tail: "100".to_string(),
                ..Default::default()
            };
            let mut stream = podman.logs(&container_id, Some(opts));
            while let Some(Ok(log)) = stream.next().await {
                let (stream_name, msg_bytes) = match log {
                    LogOutput::StdOut { message } => ("stdout", message),
                    LogOutput::StdErr { message } => ("stderr", message),
                    _ => continue,
                };
                let line = String::from_utf8_lossy(&msg_bytes).to_string();
                let msg = ComposeLogMessage {
                    service: service_name.clone(),
                    stream: if stream_name == "stdout" { "stdout" } else { "stderr" },
                    line,
                };
                let Ok(text) = serde_json::to_string(&msg) else {
                    continue;
                };
                if tx2.send(text).await.is_err() {
                    break;
                }
            }
        });
    }

    drop(tx);

    while let Some(msg) = rx.recv().await {
        if socket.send(Message::Text(msg.into())).await.is_err() {
            break;
        }
    }
}
