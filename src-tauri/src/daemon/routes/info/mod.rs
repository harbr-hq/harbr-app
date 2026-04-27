use crate::daemon::{AppError, AppState, ComposeBin};
use axum::{
    extract::State,
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ─── Response / request types ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub app_version: String,
    pub podman_version: String,
    pub socket_path: String,
    pub compose_bin: Option<String>,
    pub compose_dirs: Vec<String>,
    pub config_file: String,
    pub data_dir: String,
    pub daemon_port: u16,
}

#[derive(Debug, Serialize)]
pub struct ComposeDirsResponse {
    pub dirs: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetComposeDirsBody {
    pub dirs: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetPodmanSocketBody {
    pub socket: String,
}

// ─── Router ─────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/info", get(get_info))
        .route(
            "/settings/compose-dirs",
            get(get_compose_dirs).put(set_compose_dirs),
        )
        .route("/settings/podman-socket", axum::routing::put(set_podman_socket))
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async fn get_info(State(state): State<AppState>) -> Result<Json<AppInfo>, AppError> {
    let version = state.podman.version().await.map_err(AppError::internal)?;

    let podman_version = version
        .components
        .and_then(|c| {
            c.into_iter()
                .find(|c| c.name == "Podman Engine")
                .map(|c| c.version)
        })
        .unwrap_or_else(|| "unknown".to_string());

    let compose_bin = state.compose_bin.as_ref().map(|b| match b {
        ComposeBin::Podman => "podman compose".to_string(),
        ComposeBin::Standalone => "podman-compose".to_string(),
    });

    let compose_dirs = state
        .compose_dirs
        .read()
        .map_err(|_| AppError::internal("State lock poisoned"))?
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    Ok(Json(AppInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        podman_version,
        socket_path: state.socket_path.clone(),
        compose_bin,
        compose_dirs,
        config_file: state.config_file.clone(),
        data_dir: crate::db::default_path().to_string_lossy().to_string(),
        daemon_port: state.daemon_port,
    }))
}

async fn get_compose_dirs(
    State(state): State<AppState>,
) -> Result<Json<ComposeDirsResponse>, AppError> {
    let dirs = state
        .compose_dirs
        .read()
        .map_err(|_| AppError::internal("State lock poisoned"))?
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    Ok(Json(ComposeDirsResponse { dirs }))
}

async fn set_compose_dirs(
    State(state): State<AppState>,
    Json(body): Json<SetComposeDirsBody>,
) -> Result<StatusCode, AppError> {
    // Expand ~ and convert to PathBuf.
    let new_dirs: Vec<PathBuf> = body
        .dirs
        .iter()
        .map(|d| {
            if let Some(rest) = d.strip_prefix("~/") {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join(rest)
            } else {
                PathBuf::from(d)
            }
        })
        .collect();

    // Update in-memory state — takes effect for the next compose scan immediately.
    *state.compose_dirs.write().map_err(|_| AppError::internal("State lock poisoned"))? = new_dirs.clone();

    // Persist to ~/.config/harbr/config.toml so the setting survives restarts.
    tokio::task::spawn_blocking(move || persist_compose_dirs(&body.dirs))
        .await
        .map_err(AppError::internal)?
        .map_err(AppError::internal)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn set_podman_socket(
    Json(body): Json<SetPodmanSocketBody>,
) -> Result<StatusCode, AppError> {
    let socket = body.socket.trim().to_string();
    if socket.is_empty() {
        return Err(AppError::unprocessable("Socket path cannot be empty"));
    }
    tokio::task::spawn_blocking(move || persist_podman_socket(&socket))
        .await
        .map_err(AppError::internal)?
        .map_err(AppError::internal)?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Config file persistence ─────────────────────────────────────────────────

/// Write the compose.dirs list into the user config file, preserving all other keys.
fn persist_compose_dirs(dirs: &[String]) -> anyhow::Result<()> {
    let config_path = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("No config directory found"))?
        .join("harbr")
        .join("config.toml");

    // Read existing file (if present) so we don't clobber other settings.
    let mut table: toml::Table = if config_path.exists() {
        let raw = std::fs::read_to_string(&config_path)?;
        toml::from_str(&raw)?
    } else {
        toml::Table::new()
    };

    // Update [compose] dirs — create the section if it doesn't exist.
    let compose_section = table
        .entry("compose")
        .or_insert_with(|| toml::Value::Table(toml::Table::new()));

    if let toml::Value::Table(t) = compose_section {
        t.insert(
            "dirs".to_string(),
            toml::Value::Array(
                dirs.iter()
                    .map(|d| toml::Value::String(d.clone()))
                    .collect(),
            ),
        );
    }

    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&config_path, toml::to_string_pretty(&table)?)?;

    Ok(())
}

/// Write the podman socket path into the user config file, preserving all other keys.
fn persist_podman_socket(socket: &str) -> anyhow::Result<()> {
    let config_path = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("No config directory found"))?
        .join("harbr")
        .join("config.toml");

    let mut table: toml::Table = if config_path.exists() {
        let raw = std::fs::read_to_string(&config_path)?;
        toml::from_str(&raw)?
    } else {
        toml::Table::new()
    };

    let podman_section = table
        .entry("podman")
        .or_insert_with(|| toml::Value::Table(toml::Table::new()));

    if let toml::Value::Table(t) = podman_section {
        t.insert("socket".to_string(), toml::Value::String(socket.to_string()));
    }

    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&config_path, toml::to_string_pretty(&table)?)?;

    Ok(())
}
