use std::io::Write;

use anyhow::Context;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::path::Path;

use crate::daemon::AppState;

/// Load the token from disk, or generate and persist a new one on first run.
pub fn load_or_create_token(token_file: &Path) -> anyhow::Result<String> {
    if let Ok(contents) = std::fs::read_to_string(token_file) {
        let token = contents.trim().to_string();
        if !token.is_empty() {
            tracing::info!("Loaded auth token from {}", token_file.display());
            return Ok(token);
        }
    }

    tracing::info!("Generating new auth token at {}", token_file.display());
    let token = generate_token();

    if let Some(parent) = token_file.parent() {
        std::fs::create_dir_all(parent).context("Failed to create config directory")?;
    }

    write_token(token_file, &token).context("Failed to write token file")?;

    Ok(token)
}

fn generate_token() -> String {
    use rand::RngExt;
    let bytes: [u8; 32] = rand::rng().random();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(unix)]
fn write_token(path: &Path, token: &str) -> anyhow::Result<()> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)?
        .write_all(token.as_bytes())?;
    Ok(())
}

#[cfg(not(unix))]
fn write_token(path: &Path, token: &str) -> anyhow::Result<()> {
    std::fs::write(path, token)?;
    Ok(())
}

/// Axum middleware — validates Bearer token from Authorization header or
/// `?token=` query param (used by WebSocket connections which can't set headers).
///
/// The token is always required regardless of bind address. Binding to 127.0.0.1
/// blocks external network access, but any local user on a multi-user system could
/// otherwise reach the API without credentials.
pub async fn require_auth(State(state): State<AppState>, request: Request, next: Next) -> Response {
    tracing::debug!(
        path = %request.uri().path(),
        auth_enabled = %state.auth_enabled,
        "Auth check"
    );

    if !state.auth_enabled {
        return next.run(request).await;
    }

    // Bearer token from Authorization header
    let header_token = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    // Token from query param — WebSocket clients can't set headers
    let query_token = request.uri().query().and_then(|q| {
        q.split('&')
            .find(|p| p.starts_with("token="))
            .map(|p| p[6..].to_string())
    });

    let provided = header_token.or(query_token);

    if provided.as_deref() != Some(state.token.as_str()) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Unauthorized" })),
        )
            .into_response();
    }

    next.run(request).await
}
