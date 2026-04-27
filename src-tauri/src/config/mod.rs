use anyhow::Context;
use figment::{
    providers::{Env, Format, Serialized, Toml},
    Figment,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub podman: PodmanConfig,
    pub logging: LoggingConfig,
    pub compose: ComposeConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeConfig {
    /// Extra directories to scan for compose files in addition to the default.
    pub dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub enabled: bool,
    /// Path to the Bearer token file. Created on first run if absent.
    pub token_file: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodmanConfig {
    pub socket: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from(std::env::var("HOME").unwrap_or_default()))
            .join("harbr");

        let podman_socket = std::env::var("XDG_RUNTIME_DIR")
            .map(|d| format!("{d}/podman/podman.sock"))
            .unwrap_or_else(|_| "/run/user/1000/podman/podman.sock".to_string());

        let default_compose_dir = config_dir.join("compose").to_string_lossy().into_owned();

        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 9090,
            },
            auth: AuthConfig {
                enabled: true,
                token_file: config_dir.join("token"),
            },
            podman: PodmanConfig {
                socket: podman_socket,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
            },
            compose: ComposeConfig {
                dirs: vec![default_compose_dir],
            },
        }
    }
}

/// Load config with Figment layering:
///   built-in defaults
///   → /etc/harbr/config.toml (system)
///   → ~/.config/harbr/config.toml (user)
///   → HARBR_* environment variables
///   → explicit --config path (if provided)
pub fn load(override_path: Option<&Path>) -> anyhow::Result<AppConfig> {
    let user_config = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from(std::env::var("HOME").unwrap_or_default()))
        .join("harbr")
        .join("config.toml");

    let mut figment = Figment::new()
        .merge(Serialized::defaults(AppConfig::default()))
        .merge(Toml::file("/etc/harbr/config.toml"))
        .merge(Toml::file(&user_config))
        .merge(Env::prefixed("HARBR_").split("_"));

    if let Some(path) = override_path {
        figment = figment.merge(Toml::file(path));
    }

    figment.extract().context("Failed to load config")
}
