use crate::daemon::{AppError, AppState};
use anyhow::Context;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use bollard::{
    query_parameters::{
        InspectContainerOptions, ListContainersOptions,
        RemoveContainerOptions, StartContainerOptions, StopContainerOptions,
    },
    Docker,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── List types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Container {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: ContainerStatus,
    /// Unix timestamp of container creation.
    pub created: i64,
    /// Port mappings in "host_port:container_port/proto" format, e.g. "8080:80/tcp".
    pub ports: Vec<String>,
    /// Compose project name from `com.docker.compose.project` or `io.podman.compose.project` label.
    pub compose_project: Option<String>,
    /// Compose service name from `com.docker.compose.service` or `io.podman.compose.service` label.
    pub compose_service: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContainerStatus {
    Running,
    Stopped,
    Paused,
    Exited,
    Unknown,
}

impl ContainerStatus {
    fn from_state(s: &str) -> Self {
        match s {
            "running" | "stopping" => Self::Running,
            "paused" => Self::Paused,
            "exited" | "dead" => Self::Exited,
            "created" | "stopped" => Self::Stopped,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Stopped => "stopped",
            Self::Paused => "paused",
            Self::Exited => "exited",
            Self::Unknown => "unknown",
        }
    }

    pub fn is_running(&self) -> bool {
        matches!(self, Self::Running)
    }
}

// ─── Inspect types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ContainerInspect {
    pub id: String,
    pub name: String,
    pub image: String,
    pub image_id: String,
    pub created: Option<String>,
    pub command: Vec<String>,
    pub entrypoint: Vec<String>,
    pub working_dir: String,
    pub hostname: String,
    pub env: Vec<String>,
    pub labels: HashMap<String, String>,
    pub networks: Vec<ContainerNetwork>,
    pub mounts: Vec<ContainerMount>,
    pub ports: Vec<ContainerPort>,
    pub restart_policy: String,
    /// Bytes. None means no cgroup limit set.
    pub memory_limit: Option<i64>,
    /// Host PID. None when container is not running.
    pub pid: Option<i64>,
    /// Only populated when the container has exited.
    pub exit_code: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ContainerNetwork {
    pub name: String,
    pub ip: Option<String>,
    pub gateway: Option<String>,
    pub mac: Option<String>,
    pub prefix_len: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ContainerMount {
    pub mount_type: String,
    pub name: Option<String>,
    pub source: Option<String>,
    pub destination: String,
    pub mode: String,
    pub rw: bool,
}

#[derive(Debug, Serialize)]
pub struct ContainerPort {
    pub host_ip: Option<String>,
    pub host_port: Option<u16>,
    pub container_port: u16,
    pub proto: String,
}

// ─── Router ────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/containers", get(list_containers).post(run_container))
        .route("/containers/{id}/stop", post(stop_container))
        .route("/containers/{id}/start", post(start_container))
        .route("/containers/{id}/pause", post(pause_container))
        .route("/containers/{id}/unpause", post(unpause_container))
        .route("/containers/{id}/inspect", get(container_inspect))
        .route("/containers/{id}/restart-policy", put(set_restart_policy))
        .route("/containers/{id}", delete(remove_container))
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async fn start_container(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state
        .podman
        .start_container(&id, None::<StartContainerOptions>)
        .await?;
    verify_running(&state.podman, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn stop_container(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    // Fire and forget — return immediately so the UI isn't blocked for the
    // full grace period. The frontend polls for the resulting state change.
    let podman = state.podman.clone();
    tokio::spawn(async move {
        let _ = podman
            .stop_container(&id, Some(StopContainerOptions { t: Some(10), ..Default::default() }))
            .await;
    });
    Ok(StatusCode::NO_CONTENT)
}

async fn remove_container(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state
        .podman
        .remove_container(
            &id,
            Some(RemoveContainerOptions {
                force: true,
                ..Default::default()
            }),
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn pause_container(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state.podman.pause_container(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn unpause_container(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state.podman.unpause_container(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct PortMapping {
    /// Host port to bind, e.g. 8080.
    pub host_port: u16,
    /// Container port, e.g. 80.
    pub container_port: u16,
    /// Protocol: "tcp" or "udp". Defaults to "tcp".
    #[serde(default = "default_proto")]
    pub proto: String,
}

fn default_proto() -> String {
    "tcp".to_string()
}

#[derive(Debug, Deserialize)]
pub struct RunContainerBody {
    /// Image name (fully-qualified recommended, e.g. docker.io/library/nginx:latest).
    pub image: String,
    /// Optional container name.
    pub name: Option<String>,
    /// Port mappings.
    #[serde(default)]
    pub ports: Vec<PortMapping>,
    /// Environment variables in KEY=VALUE format.
    #[serde(default)]
    pub env: Vec<String>,
    /// Command override.
    #[serde(default)]
    pub cmd: Vec<String>,
}

async fn run_container(
    State(state): State<AppState>,
    Json(body): Json<RunContainerBody>,
) -> Result<StatusCode, AppError> {
    // Use `podman create` via subprocess to avoid bollard's JSON schema
    // validation failing on Podman's response format for the create endpoint.
    let mut args: Vec<String> = vec!["create".to_string()];

    if let Some(ref name) = body.name {
        args.push("--name".to_string());
        args.push(name.clone());
    }

    for p in &body.ports {
        args.push("--publish".to_string());
        args.push(format!("{}:{}/{}", p.host_port, p.container_port, p.proto));
    }

    for e in &body.env {
        args.push("--env".to_string());
        args.push(e.clone());
    }

    args.push(body.image.clone());
    args.extend(body.cmd.iter().cloned());

    let out = tokio::process::Command::new("podman")
        .args(&args)
        .output()
        .await
        .map_err(|e| AppError::internal(format!("Failed to spawn podman: {e}")))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(map_create_error(&stderr));
    }

    let container_id = String::from_utf8_lossy(&out.stdout).trim().to_string();

    // Start via bollard — POST /containers/{id}/start returns 204 No Content,
    // so there is no response body for bollard to choke on.
    if let Err(e) = state
        .podman
        .start_container(&container_id, None::<StartContainerOptions>)
        .await
    {
        // Podman rejected the start — clean up the orphaned container.
        let _ = tokio::process::Command::new("podman")
            .args(["rm", "-f", &container_id])
            .output()
            .await;
        return Err(AppError::from(e));
    }

    // Verify the container is still alive — a bad command causes an immediate exit.
    if let Err(e) = verify_running(&state.podman, &container_id).await {
        let _ = tokio::process::Command::new("podman")
            .args(["rm", "-f", &container_id])
            .output()
            .await;
        return Err(e);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Wait briefly after a start call and inspect the container to confirm it
/// is still running. Returns an error if it exited immediately (e.g. bad command).
async fn verify_running(podman: &Docker, id: &str) -> Result<(), AppError> {
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    let inspect = podman
        .inspect_container(id, None::<InspectContainerOptions>)
        .await
        .map_err(AppError::internal)?;

    let state = inspect.state.as_ref();
    let running = state.and_then(|s| s.running).unwrap_or(false);
    let exit_code = state.and_then(|s| s.exit_code).unwrap_or(0);

    if !running {
        let msg = if exit_code != 0 {
            format!("Container exited immediately with code {exit_code} — check the command or image")
        } else {
            "Container exited immediately — no command specified or the command completed instantly".to_string()
        };
        return Err(AppError::unprocessable(msg));
    }

    Ok(())
}

/// Map `podman create` stderr to an appropriate HTTP error.
fn map_create_error(stderr: &str) -> AppError {
    if stderr.contains("address already in use") || stderr.contains("rootlessport") {
        AppError::unprocessable(
            "A host port required by this container is already in use. \
             Stop the conflicting container or process first.",
        )
    } else if stderr.contains("name is already in use") || stderr.contains("Conflict") {
        AppError::unprocessable(
            "A container with that name already exists. \
             Remove or rename the existing container first.",
        )
    } else if stderr.contains("No such image")
        || stderr.contains("image not known")
        || stderr.contains("not found")
    {
        AppError::not_found("Image not found — pull it with Podman first")
    } else {
        tracing::error!("podman create failed: {stderr}");
        AppError::internal(stderr)
    }
}

// ─── podman ps fallback ──────────────────────────────────────────────────────

/// JSON structure emitted by `podman ps --all --no-trunc --format json`.
/// Uses plain strings for state — no bollard enum, so no deserialisation failure
/// on Podman-specific states like "stopping", "degraded", "initialized".
#[derive(Deserialize)]
struct PodmanPsEntry {
    #[serde(rename = "Id")]
    id: String,
    #[serde(default, rename = "Names")]
    names: Vec<String>,
    #[serde(rename = "Image")]
    image: String,
    #[serde(rename = "State")]
    state: String,
    /// Unix timestamp of when the container was last started.
    /// Used as a proxy for creation time in this fallback path.
    #[serde(default, rename = "StartedAt")]
    started_at: i64,
    #[serde(default, rename = "Labels")]
    labels: Option<HashMap<String, String>>,
    #[serde(default, rename = "Ports")]
    ports: Option<Vec<PodmanPsPort>>,
    #[serde(default, rename = "IsInfra")]
    is_infra: bool,
}

/// Port mapping as returned by `podman ps --format json`.
#[derive(Deserialize, Default)]
struct PodmanPsPort {
    #[serde(default)]
    host_port: u16,
    #[serde(default)]
    container_port: u16,
    #[serde(default = "default_proto")]
    protocol: String,
}

/// Fetch containers by running `podman ps --all --no-trunc --format json`.
/// Used as a fallback when bollard fails to deserialise an unknown state variant
/// (e.g. Podman-specific "stopping" or "degraded" states not in the Docker API enum).
/// Returns plain-string states so no container is ever dropped due to an unknown state.
async fn fetch_containers_subprocess() -> anyhow::Result<Vec<Container>> {
    let out = tokio::process::Command::new("podman")
        .args(["ps", "--all", "--no-trunc", "--format", "json"])
        .output()
        .await
        .context("Failed to spawn `podman ps`")?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow::anyhow!("`podman ps` subprocess failed: {stderr}"));
    }

    let entries: Vec<PodmanPsEntry> = serde_json::from_slice(&out.stdout)
        .context("Failed to parse `podman ps --format json` output")?;

    Ok(entries
        .into_iter()
        .filter(|e| !e.is_infra)
        .map(|e| {
            let name = e
                .names
                .into_iter()
                .next()
                .map(|n: String| n.trim_start_matches('/').to_string())
                .unwrap_or_default();

            let ports = e
                .ports
                .unwrap_or_default()
                .iter()
                .filter_map(|p| {
                    if p.host_port == 0 {
                        return None;
                    }
                    Some(format!("{}:{}/{}", p.host_port, p.container_port, p.protocol))
                })
                .collect();

            let labels = e.labels.unwrap_or_default();
            let compose_project = labels
                .get("com.docker.compose.project")
                .or_else(|| labels.get("io.podman.compose.project"))
                .cloned();
            let compose_service = labels
                .get("com.docker.compose.service")
                .or_else(|| labels.get("io.podman.compose.service"))
                .cloned();

            Container {
                id: e.id,
                name,
                image: e.image,
                status: ContainerStatus::from_state(&e.state),
                created: e.started_at,
                ports,
                compose_project,
                compose_service,
            }
        })
        .collect())
}

// ─── Primary fetch ───────────────────────────────────────────────────────────

/// Fetch and map all containers from the Podman socket.
/// Shared by the list handler and the groups route module.
pub async fn fetch_containers(podman: &Docker) -> anyhow::Result<Vec<Container>> {
    let opts = ListContainersOptions {
        all: true,
        ..Default::default()
    };

    let summaries = match podman.list_containers(Some(opts)).await {
        Ok(s) => s,
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("unknown variant") || msg.contains("unknown container state") {
                // Podman returned a container in a state bollard's enum doesn't include
                // (e.g. "stopping", "degraded"). The filter-based approach would silently
                // drop those containers — instead, fall back to `podman ps` which uses
                // plain string states so every container is always returned.
                tracing::debug!(
                    "bollard list_containers hit unknown state variant ({}); \
                     falling back to podman ps subprocess",
                    msg.lines().next().unwrap_or(&msg)
                );
                return fetch_containers_subprocess().await;
            }
            return Err(anyhow::anyhow!("Podman list_containers failed: {e}"));
        }
    };

    let containers = summaries
        .into_iter()
        .map(|s| {
            let name = s
                .names
                .as_deref()
                .and_then(|n| n.first())
                .map(|n| n.trim_start_matches('/').to_string())
                .unwrap_or_default();

            let ports = s
                .ports
                .unwrap_or_default()
                .into_iter()
                .filter_map(|p| {
                    let public = p.public_port?;
                    let proto = p.typ.map(|t| format!("/{t}")).unwrap_or_default();
                    Some(format!("{}:{}{}", public, p.private_port, proto))
                })
                .collect();

            let labels = s.labels.as_ref();
            let compose_project = labels
                .and_then(|l| {
                    l.get("com.docker.compose.project")
                        .or_else(|| l.get("io.podman.compose.project"))
                })
                .cloned();
            let compose_service = labels
                .and_then(|l| {
                    l.get("com.docker.compose.service")
                        .or_else(|| l.get("io.podman.compose.service"))
                })
                .cloned();

            Container {
                id: s.id.unwrap_or_default(),
                name,
                image: s.image.unwrap_or_default(),
                status: ContainerStatus::from_state(&s.state.map(|st| st.to_string()).unwrap_or_default()),
                created: s.created.unwrap_or(0),
                ports,
                compose_project,
                compose_service,
            }
        })
        .collect();

    Ok(containers)
}

async fn list_containers(
    State(state): State<AppState>,
) -> Result<Json<Vec<Container>>, AppError> {
    let containers = fetch_containers(&state.podman).await?;
    Ok(Json(containers))
}

async fn container_inspect(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ContainerInspect>, AppError> {
    let r = state
        .podman
        .inspect_container(&id, None::<InspectContainerOptions>)
        .await?;

    let cfg = r.config.as_ref();
    let container_state = r.state.as_ref();
    let hc = r.host_config.as_ref();

    let is_running = container_state
        .and_then(|s| s.running)
        .unwrap_or(false);

    let networks: Vec<ContainerNetwork> = r
        .network_settings
        .as_ref()
        .and_then(|ns| ns.networks.as_ref())
        .map(|nets| {
            nets.iter()
                .map(|(name, ep)| ContainerNetwork {
                    name: name.clone(),
                    ip: ep.ip_address.clone().filter(|s| !s.is_empty()),
                    gateway: ep.gateway.clone().filter(|s| !s.is_empty()),
                    mac: ep.mac_address.clone().filter(|s| !s.is_empty()),
                    prefix_len: ep.ip_prefix_len,
                })
                .collect()
        })
        .unwrap_or_default();

    let mounts: Vec<ContainerMount> = r
        .mounts
        .as_ref()
        .map(|ms| {
            ms.iter()
                .map(|m| ContainerMount {
                    mount_type: m
                        .typ
                        .as_ref()
                        .map(|t| format!("{t:?}").to_lowercase())
                        .unwrap_or_default(),
                    name: m.name.clone(),
                    source: m.source.clone(),
                    destination: m.destination.clone().unwrap_or_default(),
                    mode: m.mode.clone().unwrap_or_default(),
                    rw: m.rw.unwrap_or(true),
                })
                .collect()
        })
        .unwrap_or_default();

    // network_settings.ports maps "container_port/proto" → [{ host_ip, host_port }]
    let ports: Vec<ContainerPort> = r
        .network_settings
        .as_ref()
        .and_then(|ns| ns.ports.as_ref())
        .map(|port_map| {
            port_map
                .iter()
                .flat_map(|(key, bindings)| {
                    let (container_port, proto) = key
                        .split_once('/')
                        .map(|(p, t)| (p.parse::<u16>().unwrap_or(0), t.to_string()))
                        .unwrap_or((0, "tcp".to_string()));
                    match bindings {
                        None => vec![ContainerPort {
                            host_ip: None,
                            host_port: None,
                            container_port,
                            proto,
                        }],
                        Some(binds) if binds.is_empty() => vec![ContainerPort {
                            host_ip: None,
                            host_port: None,
                            container_port,
                            proto,
                        }],
                        Some(binds) => binds
                            .iter()
                            .map(|b| ContainerPort {
                                host_ip: b.host_ip.clone().filter(|s| !s.is_empty()),
                                host_port: b.host_port.as_ref().and_then(|p| p.parse().ok()),
                                container_port,
                                proto: proto.clone(),
                            })
                            .collect(),
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    let restart_policy = hc
        .and_then(|h| h.restart_policy.as_ref())
        .and_then(|rp| rp.name.as_ref())
        .map(|n| {
            let s = format!("{n:?}").to_lowercase().replace('_', "-");
            if s == "empty" {
                "no".to_string()
            } else {
                s
            }
        })
        .unwrap_or_else(|| "no".to_string());

    let inspect = ContainerInspect {
        id: r.id.unwrap_or_default(),
        name: r
            .name
            .unwrap_or_default()
            .trim_start_matches('/')
            .to_string(),
        image: cfg.and_then(|c| c.image.clone()).unwrap_or_default(),
        image_id: r.image.unwrap_or_default(),
        created: r.created,
        command: cfg.and_then(|c| c.cmd.clone()).unwrap_or_default(),
        entrypoint: cfg.and_then(|c| c.entrypoint.clone()).unwrap_or_default(),
        working_dir: cfg
            .and_then(|c| c.working_dir.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_default(),
        hostname: cfg.and_then(|c| c.hostname.clone()).unwrap_or_default(),
        env: cfg.and_then(|c| c.env.clone()).unwrap_or_default(),
        labels: cfg.and_then(|c| c.labels.clone()).unwrap_or_default(),
        networks,
        mounts,
        ports,
        restart_policy,
        memory_limit: hc.and_then(|h| h.memory).filter(|&m| m > 0),
        pid: if is_running {
            container_state.and_then(|s| s.pid).filter(|&p| p > 0)
        } else {
            None
        },
        exit_code: if is_running {
            None
        } else {
            container_state.and_then(|s| s.exit_code)
        },
    };

    Ok(Json(inspect))
}

// ─── Restart policy ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetRestartPolicyBody {
    /// One of: "no", "always", "unless-stopped", "on-failure".
    pub policy: String,
}

async fn set_restart_policy(
    Path(id): Path<String>,
    Json(body): Json<SetRestartPolicyBody>,
) -> Result<StatusCode, AppError> {
    let policy = match body.policy.as_str() {
        v @ ("no" | "always" | "unless-stopped" | "on-failure") => v.to_string(),
        other => return Err(AppError::unprocessable(format!("Unknown restart policy: {other}"))),
    };

    let output = tokio::process::Command::new("podman")
        .args(["container", "update", "--restart", &policy, &id])
        .output()
        .await
        .map_err(|e| AppError::internal(format!("Failed to spawn podman: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::unprocessable(format!("podman update failed: {stderr}")));
    }

    Ok(StatusCode::NO_CONTENT)
}
