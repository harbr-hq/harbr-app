use crate::daemon::{AppError, AppState};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use bollard::query_parameters::{CreateImageOptions, ListImagesOptions, PruneImagesOptions, RemoveImageOptions};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Response types ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Image {
    /// Full content-addressable ID (sha256:...).
    pub id: String,
    /// All repo:tag pairs that reference this image. Empty = untagged.
    pub repo_tags: Vec<String>,
    /// Unix timestamp of image creation.
    pub created: i64,
    /// Total size in bytes including all layers.
    pub size: i64,
    /// Number of containers using this image. -1 means not calculated.
    pub containers: i64,
}

#[derive(Debug, Serialize)]
pub struct ImageDetails {
    pub architecture: Option<String>,
    pub os: Option<String>,
    pub author: Option<String>,
    pub cmd: Vec<String>,
    pub entrypoint: Vec<String>,
    pub env: Vec<String>,
    /// Port specs in "port/proto" format, e.g. "80/tcp".
    pub exposed_ports: Vec<String>,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct PruneResult {
    pub deleted_count: usize,
    pub space_reclaimed: u64,
}

/// Streamed over the pull WebSocket.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PullEvent {
    Progress { status: String, progress: Option<String> },
    Error { message: String },
    Done,
}

// ─── Query params ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RemoveQuery {
    force: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct PullQuery {
    /// Image reference to pull, e.g. "nginx:latest" or "ghcr.io/foo/bar:v1".
    #[serde(rename = "ref")]
    image_ref: String,
}

// ─── Router ────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/images", get(list_images))
        // Static path must be registered before :id so Axum doesn't swallow it.
        .route("/images/pull", get(pull_ws))
        .route("/images/prune", post(prune_images))
        .route("/images/{id}", delete(remove_image))
        .route("/images/{id}/inspect", get(inspect_image))
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async fn list_images(
    State(state): State<AppState>,
) -> Result<Json<Vec<Image>>, AppError> {
    let summaries = state
        .podman
        .list_images(Some(ListImagesOptions {
            all: false,
            ..Default::default()
        }))
        .await?;

    let images = summaries
        .into_iter()
        .map(|s| Image {
            id: s.id,
            repo_tags: s.repo_tags,
            created: s.created,
            size: s.size,
            containers: s.containers,
        })
        .collect();

    Ok(Json(images))
}

async fn remove_image(
    Path(id): Path<String>,
    Query(query): Query<RemoveQuery>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state
        .podman
        .remove_image(
            &id,
            Some(RemoveImageOptions {
                force: query.force.unwrap_or(false),
                noprune: false,
                ..Default::default()
            }),
            None,
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn prune_images(
    State(state): State<AppState>,
) -> Result<Json<PruneResult>, AppError> {
    let response = state
        .podman
        .prune_images(None::<PruneImagesOptions>)
        .await?;

    let deleted_count = response.images_deleted.as_ref().map(Vec::len).unwrap_or(0);
    let space_reclaimed = response.space_reclaimed.unwrap_or(0) as u64;

    Ok(Json(PruneResult { deleted_count, space_reclaimed }))
}

async fn inspect_image(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ImageDetails>, AppError> {
    let info = state.podman.inspect_image(&id).await?;

    let config = info.config.as_ref();

    let cmd = config.and_then(|c| c.cmd.clone()).unwrap_or_default();
    let entrypoint = config.and_then(|c| c.entrypoint.clone()).unwrap_or_default();
    let env = config.and_then(|c| c.env.clone()).unwrap_or_default();
    let exposed_ports = config
        .and_then(|c| c.exposed_ports.clone())
        .unwrap_or_default();
    let labels = config.and_then(|c| c.labels.clone()).unwrap_or_default();

    Ok(Json(ImageDetails {
        architecture: info.architecture,
        os: info.os,
        author: info.author,
        cmd,
        entrypoint,
        env,
        exposed_ports,
        labels,
    }))
}

async fn pull_ws(
    ws: WebSocketUpgrade,
    Query(query): Query<PullQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| stream_pull(socket, query.image_ref, state))
}

/// Normalise a short image reference to a fully qualified name that Podman's
/// Docker compat API accepts. Examples:
///   `redis:alpine`     → `docker.io/library/redis:alpine`
///   `bitnami/redis:7`  → `docker.io/bitnami/redis:7`
///   `ghcr.io/foo/bar`  → unchanged (already has a registry)
fn normalise_image_ref(image_ref: &str) -> String {
    let Some(slash_pos) = image_ref.find('/') else {
        // No slash — it's an official Docker Hub image like "nginx" or "redis:alpine".
        return format!("docker.io/library/{image_ref}");
    };

    let first_component = &image_ref[..slash_pos];
    let has_registry = first_component.contains('.')   // ghcr.io, docker.io, 192.168.x.x
        || first_component.contains(':')               // localhost:5000
        || first_component == "localhost";

    if has_registry {
        image_ref.to_string()
    } else {
        // e.g. "bitnami/redis:7" → "docker.io/bitnami/redis:7"
        format!("docker.io/{image_ref}")
    }
}

async fn stream_pull(mut socket: WebSocket, image_ref: String, state: AppState) {
    let qualified = normalise_image_ref(&image_ref);

    // Podman's Docker compat API requires name and tag as separate parameters.
    // Passing "docker.io/library/redis:alpine" as a single fromImage triggers
    // its normaliser and produces "invalid reference format".
    let (name, tag): (String, String) = match qualified.rfind(':') {
        Some(pos) if !qualified[pos + 1..].contains('/') => {
            (qualified[..pos].to_string(), qualified[pos + 1..].to_string())
        }
        _ => (qualified.clone(), "latest".to_string()),
    };

    let mut stream = state.podman.create_image(
        Some(CreateImageOptions {
            from_image: Some(name),
            tag: Some(tag),
            ..Default::default()
        }),
        None,
        None,
    );

    while let Some(result) = stream.next().await {
        let event = match result {
            Ok(info) => {
                if let Some(err) = info.error_detail.as_ref().and_then(|e| e.message.clone()) {
                    PullEvent::Error { message: err }
                } else {
                    PullEvent::Progress {
                        status: info.status.unwrap_or_default(),
                        progress: None,
                    }
                }
            }
            Err(e) => PullEvent::Error { message: e.to_string() },
        };

        let is_err = matches!(event, PullEvent::Error { .. });
        let Ok(text) = serde_json::to_string(&event) else { continue };

        if socket.send(Message::Text(text.into())).await.is_err() {
            return; // client disconnected
        }
        if is_err {
            return;
        }
    }

    let Ok(done) = serde_json::to_string(&PullEvent::Done) else { return };
    let _ = socket.send(Message::Text(done.into())).await;
}
