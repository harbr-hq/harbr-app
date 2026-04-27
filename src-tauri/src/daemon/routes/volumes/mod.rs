use crate::daemon::{AppError, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use bollard::{
    models::VolumeCreateRequest,
    query_parameters::{ListContainersOptions, ListVolumesOptions, PruneVolumesOptions, RemoveVolumeOptions},
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, time::UNIX_EPOCH};

// ─── Response types ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Volume {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub created_at: Option<String>,
    pub scope: String,
    pub labels: HashMap<String, String>,
    pub options: HashMap<String, String>,
    /// Disk usage in bytes. -1 = not calculated.
    pub size: i64,
    /// Number of containers referencing this volume. -1 = not calculated.
    pub ref_count: i64,
}

#[derive(Debug, Serialize)]
pub struct VolumeContainer {
    pub id: String,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct PruneResult {
    pub deleted_count: usize,
    pub space_reclaimed: u64,
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    /// Path relative to the volume root, e.g. "/subdir/file.txt".
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// Unix timestamp of last modification.
    pub modified: Option<i64>,
}

// ─── Request types ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateVolumeBody {
    pub name: String,
    #[serde(default = "default_driver")]
    pub driver: String,
}

fn default_driver() -> String {
    "local".to_string()
}

// ─── Router ────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/volumes", get(list_volumes).post(create_volume))
        // Static path before :name so Axum doesn't swallow it.
        .route("/volumes/prune", post(prune_volumes))
        .route("/volumes/{name}", delete(remove_volume))
        .route("/volumes/{name}/containers", get(volume_containers))
        .route("/volumes/{name}/files", get(browse_volume))
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async fn list_volumes(
    State(state): State<AppState>,
) -> Result<Json<Vec<Volume>>, AppError> {
    // Fetch volumes and containers concurrently.
    let (volume_response, containers) = tokio::try_join!(
        state.podman.list_volumes(None::<ListVolumesOptions>),
        state.podman.list_containers(Some(ListContainersOptions {
            all: true,
            ..Default::default()
        })),
    )?;

    // Podman doesn't expose per-volume sizes in list_volumes or df in bollard 0.20.
    let sizes: HashMap<String, i64> = HashMap::new();

    // Compute ref_count from actual container mount data — Podman doesn't
    // populate usage_data.ref_count in list_volumes responses.
    let mut ref_counts: HashMap<String, i64> = HashMap::new();
    for c in &containers {
        for mount in c.mounts.as_deref().unwrap_or(&[]) {
            if let Some(vol_name) = &mount.name {
                *ref_counts.entry(vol_name.clone()).or_insert(0) += 1;
            }
        }
    }

    let volumes = volume_response
        .volumes
        .unwrap_or_default()
        .into_iter()
        .map(|v| {
            let ref_count = ref_counts.get(&v.name).copied().unwrap_or(0);
            let size = sizes.get(&v.name).copied().unwrap_or(-1);
            Volume {
                name: v.name,
                driver: v.driver,
                mountpoint: v.mountpoint,
                created_at: v.created_at,
                scope: v.scope.map(|s| s.to_string()).unwrap_or_default(),
                labels: v.labels,
                options: v.options,
                size,
                ref_count,
            }
        })
        .collect();

    Ok(Json(volumes))
}

async fn create_volume(
    State(state): State<AppState>,
    Json(body): Json<CreateVolumeBody>,
) -> Result<Json<Volume>, AppError> {
    let v = state
        .podman
        .create_volume(VolumeCreateRequest {
            name: Some(body.name),
            driver: Some(body.driver),
            ..Default::default()
        })
        .await?;

    Ok(Json(Volume {
        name: v.name,
        driver: v.driver,
        mountpoint: v.mountpoint,
        created_at: v.created_at,
        scope: v.scope.map(|s| s.to_string()).unwrap_or_default(),
        labels: v.labels,
        options: v.options,
        size: v.usage_data.as_ref().map(|u| u.size).unwrap_or(-1),
        ref_count: v.usage_data.as_ref().map(|u| u.ref_count).unwrap_or(-1),
    }))
}

async fn remove_volume(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state.podman.remove_volume(&name, None::<RemoveVolumeOptions>).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn prune_volumes(
    State(state): State<AppState>,
) -> Result<Json<PruneResult>, AppError> {
    let response = state
        .podman
        .prune_volumes(None::<PruneVolumesOptions>)
        .await?;

    let deleted_count = response.volumes_deleted.as_ref().map(Vec::len).unwrap_or(0);

    Ok(Json(PruneResult {
        deleted_count,
        space_reclaimed: response.space_reclaimed.unwrap_or(0).max(0) as u64,
    }))
}

async fn volume_containers(
    Path(name): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Vec<VolumeContainer>>, AppError> {
    let all = state
        .podman
        .list_containers(Some(ListContainersOptions {
            all: true,
            ..Default::default()
        }))
        .await?;

    let using = all
        .into_iter()
        .filter(|c| {
            c.mounts
                .as_deref()
                .unwrap_or(&[])
                .iter()
                .any(|m| m.name.as_deref() == Some(name.as_str()))
        })
        .map(|c| {
            let cname = c
                .names
                .as_deref()
                .and_then(|n| n.first())
                .map(|n| n.trim_start_matches('/').to_string())
                .unwrap_or_default();
            VolumeContainer {
                id: c.id.unwrap_or_default(),
                name: cname,
                status: c.state.map(|st| st.to_string()).unwrap_or_default(),
            }
        })
        .collect();

    Ok(Json(using))
}

#[derive(Debug, Deserialize)]
struct BrowseQuery {
    #[serde(default)]
    path: String,
}

async fn browse_volume(
    Path(name): Path<String>,
    Query(query): Query<BrowseQuery>,
    State(state): State<AppState>,
) -> Result<Json<Vec<FileEntry>>, AppError> {
    let vol = state.podman.inspect_volume(&name).await?;

    let mountpoint = PathBuf::from(&vol.mountpoint);

    // Resolve the requested sub-path relative to the volume root.
    let rel = query.path.trim_start_matches('/');
    let target = if rel.is_empty() { mountpoint.clone() } else { mountpoint.join(rel) };

    // Canonicalise to resolve symlinks, then verify it's still inside the volume.
    // tokio::fs::canonicalize is the async equivalent — avoids blocking the runtime.
    let canonical_base = tokio::fs::canonicalize(&mountpoint)
        .await
        .map_err(|_| AppError::not_found(
            "Volume mountpoint is not accessible from the host filesystem. \
             On Windows the volume lives inside the Podman/Docker VM and cannot be browsed directly."
        ))?;
    let canonical = tokio::fs::canonicalize(&target)
        .await
        .map_err(AppError::not_found)?;
    if !canonical.starts_with(&canonical_base) {
        return Err(AppError::forbidden("Path is outside the volume"));
    }

    let mut read_dir = tokio::fs::read_dir(&canonical)
        .await
        .map_err(AppError::internal)?;

    let mut entries: Vec<FileEntry> = Vec::new();
    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(AppError::internal)?
    {
        let file_name = entry.file_name().to_string_lossy().to_string();
        let meta = entry.metadata().await.ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        // Build path relative to volume root (always starts with /).
        let base = query.path.trim_end_matches('/');
        let entry_path = if base.is_empty() {
            format!("/{file_name}")
        } else {
            format!("{base}/{file_name}")
        };

        entries.push(FileEntry { name: file_name, path: entry_path, is_dir, size, modified });
    }

    // Directories first, then files; each group sorted alphabetically.
    entries.sort_unstable_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name))
    });

    Ok(Json(entries))
}
