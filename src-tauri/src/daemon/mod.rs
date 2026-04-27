pub mod auth;
pub mod error;
pub mod log_collector;
pub mod routes;

pub use error::AppError;

use anyhow::Context;
use bollard::Docker;
use std::{
    path::PathBuf,
    sync::{
        atomic::AtomicBool,
        Arc, RwLock,
    },
};
use surrealdb::{engine::local::Db, Surreal};
use tokio::net::TcpListener;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

use crate::config::AppConfig;

/// Which compose binary is available on this system.
#[derive(Debug, Clone)]
pub enum ComposeBin {
    /// Invoked as: `podman compose <args>`
    Podman,
    /// Invoked as: `podman-compose <args>`
    Standalone,
}

/// Shared application state injected into every Axum handler.
#[derive(Clone)]
pub struct AppState {
    pub podman: Docker,
    pub db: Surreal<Db>,
    pub token: String,
    pub auth_enabled: bool,
    /// Which compose binary was detected at startup. None if neither is available.
    pub compose_bin: Option<ComposeBin>,
    /// Directories to scan for compose files. Wrapped in Arc<RwLock> so the
    /// settings endpoint can update them at runtime without a restart.
    pub compose_dirs: Arc<RwLock<Vec<PathBuf>>>,
    /// Podman socket path for display in the info endpoint.
    pub socket_path: String,
    /// Path to the active config file (best-guess default if not overridden).
    pub config_file: String,
    /// Port the daemon is bound to. Exposed via /info for display purposes.
    pub daemon_port: u16,
    /// Whether OS system notifications are enabled. Shared with the Tauri layer
    /// so changes via the preferences toggle take effect immediately.
    pub notifications_enabled: Arc<AtomicBool>,
    /// Tauri app handle — used to emit events to the frontend (e.g. containers-changed).
    pub app_handle: tauri::AppHandle,
}

/// Detect which compose binary is available.
async fn detect_compose_bin() -> Option<ComposeBin> {
    if Command::new("podman")
        .args(["compose", "version"])
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some(ComposeBin::Podman);
    }
    if Command::new("podman-compose")
        .args(["--version"])
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some(ComposeBin::Standalone);
    }
    tracing::warn!("No compose binary found — compose operations will be unavailable");
    None
}

/// Start the Axum HTTP server. Blocks until graceful shutdown completes,
/// then calls `app_handle.exit(0)`. Intended to be spawned on a background task.
pub async fn start(
    config: AppConfig,
    token: String,
    shutdown: CancellationToken,
    app_handle: tauri::AppHandle,
    notifications_enabled: Arc<AtomicBool>,
) -> anyhow::Result<()> {
    #[cfg(unix)]
    let podman =
        Docker::connect_with_socket(&config.podman.socket, 30, bollard::API_DEFAULT_VERSION)
            .with_context(|| {
                format!(
                    "Failed to connect to Podman socket at {}",
                    config.podman.socket
                )
            })?;

    #[cfg(windows)]
    let podman =
        Docker::connect_with_named_pipe(&config.podman.socket, 30, bollard::API_DEFAULT_VERSION)
            .with_context(|| {
                format!(
                    "Failed to connect to Podman named pipe at {}",
                    config.podman.socket
                )
            })?;

    let _: String = podman
        .ping()
        .await
        .context("Podman socket ping failed — is Podman running?")?;

    tracing::info!("Connected to Podman at {}", config.podman.socket);

    let db = crate::db::init(crate::db::default_path())
        .await
        .context("Failed to initialise SurrealDB")?;

    let compose_bin = detect_compose_bin().await;
    if let Some(ref bin) = compose_bin {
        tracing::info!("Compose binary: {:?}", bin);
    }

    // Expand ~ in compose dirs and convert to PathBuf.
    let compose_dirs: Vec<PathBuf> = config
        .compose
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

    tracing::info!(
        host = %config.server.host,
        auth_enabled = %config.auth.enabled,
        "Auth configuration"
    );

    let socket_path = config.podman.socket.clone();
    let config_file = dirs::config_dir()
        .map(|d| d.join("harbr").join("config.toml").to_string_lossy().to_string())
        .unwrap_or_else(|| "~/.config/harbr/config.toml".to_string());

    let state = AppState {
        podman,
        db,
        token,
        auth_enabled: config.auth.enabled,
        compose_bin,
        compose_dirs: Arc::new(RwLock::new(compose_dirs)),
        socket_path,
        config_file,
        daemon_port: config.server.port,
        notifications_enabled,
        app_handle: app_handle.clone(),
    };

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("Failed to bind daemon to {addr}"))?;

    tracing::info!("Harbr daemon listening on {addr}");

    // Spawn the log collection daemon with its own cancellation token.
    let collector_token = CancellationToken::new();
    let collector = tokio::spawn(log_collector::run(
        state.db.clone(),
        state.podman.clone(),
        collector_token.clone(),
    ));

    // Run the server until the shutdown token is cancelled (e.g. by the tray Exit action).
    axum::serve(listener, routes::router(state))
        .with_graceful_shutdown(shutdown.cancelled_owned())
        .await
        .context("Daemon exited with error")?;

    tracing::info!("Daemon shutting down — stopping log collector");
    collector_token.cancel();
    let _ = collector.await;
    tracing::info!("Daemon shutdown complete");

    app_handle.exit(0);
    Ok(())
}
