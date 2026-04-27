use crate::{
    daemon::{AppError, AppState},
    db::groups as db_groups,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use bollard::query_parameters::{StartContainerOptions, StopContainerOptions};
use futures_util::future::join_all;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

use super::containers::crud::fetch_containers;

// ─── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum GroupKind {
    Compose,
    Custom,
    Ungrouped,
}

#[derive(Debug, Serialize)]
pub struct ContainerGroup {
    pub id: String,
    pub name: String,
    pub kind: GroupKind,
    pub locked: bool,
    pub colour: Option<String>,
    pub container_ids: Vec<String>,
}

// ─── Request bodies ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateGroupBody {
    name: String,
}

#[derive(Deserialize)]
struct UpdateGroupBody {
    name: Option<String>,
    colour: Option<String>,
}

#[derive(Deserialize)]
struct SetOrderBody {
    container_ids: Vec<String>,
}

#[derive(Deserialize)]
struct AssignContainerBody {
    container_id: String,
}

#[derive(Deserialize)]
struct SetDisplayOrderBody {
    group_ids: Vec<String>,
}

// ─── Router ──────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/groups", get(list_groups_handler).post(create_group_handler))
        // Static segment must come before the parameterised :id route.
        .route("/groups/display-order", put(set_display_order_handler))
        .route(
            "/groups/{id}",
            put(rename_group_handler).delete(delete_group_handler),
        )
        .route("/groups/{id}/order", put(set_order_handler))
        .route("/groups/{id}/containers", post(assign_container_handler))
        .route(
            "/groups/{id}/containers/{cid}",
            delete(unassign_container_handler),
        )
        .route("/groups/{id}/start", post(start_group_handler))
        .route("/groups/{id}/stop", post(stop_group_handler))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Merge a live container ID list with a stored ordering.
/// Stored IDs that no longer exist are dropped; new IDs are appended at the end.
fn apply_ordering(live_ids: Vec<String>, stored: &[String]) -> Vec<String> {
    if stored.is_empty() {
        return live_ids;
    }
    let live_set: HashSet<&str> = live_ids.iter().map(|s| s.as_str()).collect();
    let mut ordered: Vec<String> = stored
        .iter()
        .filter(|id| live_set.contains(id.as_str()))
        .cloned()
        .collect();
    // Use an owned set to avoid a borrow conflict when pushing into `ordered`.
    let ordered_set: HashSet<String> = ordered.iter().cloned().collect();
    for id in &live_ids {
        if !ordered_set.contains(id) {
            ordered.push(id.clone());
        }
    }
    ordered
}

/// Resolve the container IDs that belong to a group (for start/stop operations).
async fn resolve_group_container_ids(
    id: &str,
    state: &AppState,
) -> anyhow::Result<Vec<String>> {
    if let Some(project) = id.strip_prefix("compose:") {
        let containers = fetch_containers(&state.podman).await?;
        Ok(containers
            .into_iter()
            .filter(|c| c.compose_project.as_deref() == Some(project))
            .map(|c| c.id)
            .collect())
    } else if id == "ungrouped" {
        Ok(Vec::new())
    } else {
        let group = db_groups::get_group(&state.db, id).await?;
        Ok(group.map(|g| g.container_ids).unwrap_or_default())
    }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async fn list_groups_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<ContainerGroup>>, AppError> {
    let containers = fetch_containers(&state.podman).await?;
    let custom_groups = db_groups::list_groups(&state.db).await?;

    // Containers that belong to a compose project — these take priority and
    // are excluded from custom groups and the ungrouped catch-all.
    let compose_assigned: HashSet<String> = containers
        .iter()
        .filter(|c| c.compose_project.is_some())
        .map(|c| c.id.clone())
        .collect();

    // Containers explicitly assigned to a custom group (excluding compose containers).
    let custom_assigned: HashSet<String> = custom_groups
        .iter()
        .flat_map(|g| g.container_ids.iter().cloned())
        .filter(|id| !compose_assigned.contains(id))
        .collect();

    let mut result: Vec<ContainerGroup> = Vec::new();

    // ── Compose groups (sorted by project name) ────────────────────────────
    let mut compose_map: HashMap<String, Vec<String>> = HashMap::new();
    for c in &containers {
        if let Some(project) = &c.compose_project {
            compose_map
                .entry(project.clone())
                .or_default()
                .push(c.id.clone());
        }
    }
    let mut compose_names: Vec<String> = compose_map.keys().cloned().collect();
    compose_names.sort();
    for project in compose_names {
        let live_ids = compose_map[&project].clone();
        let order_key = format!("compose:{project}");
        let stored = db_groups::get_order(&state.db, &order_key)
            .await
            .unwrap_or(None)
            .map(|o| o.container_ids)
            .unwrap_or_default();
        let ordered_ids = apply_ordering(live_ids, &stored);
        result.push(ContainerGroup {
            id: order_key,
            name: project,
            kind: GroupKind::Compose,
            locked: true,
            colour: None,
            container_ids: ordered_ids,
        });
    }

    // ── Custom groups ──────────────────────────────────────────────────────
    // Use DB-stored container IDs directly — do NOT filter against the live
    // container list here. Podman may transiently omit containers that are in
    // a stopping/transitional state, which would cause them to flash out of
    // their group. The frontend handles missing containers gracefully
    // (renders nothing for IDs not present in its container map).
    for g in &custom_groups {
        // Order key matches what the frontend sends: the raw group UUID.
        let order_key = g.group_id.clone();
        // Only exclude containers already claimed by a compose project.
        let live_ids: Vec<String> = g
            .container_ids
            .iter()
            .filter(|id| !compose_assigned.contains(*id))
            .cloned()
            .collect();
        let stored = db_groups::get_order(&state.db, &order_key)
            .await
            .unwrap_or(None)
            .map(|o| o.container_ids)
            .unwrap_or_default();
        let ordered_ids = apply_ordering(live_ids, &stored);
        result.push(ContainerGroup {
            id: g.group_id.clone(),
            name: g.name.clone(),
            kind: GroupKind::Custom,
            locked: false,
            colour: g.colour.clone(),
            container_ids: ordered_ids,
        });
    }

    // ── Ungrouped ──────────────────────────────────────────────────────────
    let live_ungrouped: Vec<String> = containers
        .iter()
        .filter(|c| !compose_assigned.contains(&c.id) && !custom_assigned.contains(&c.id))
        .map(|c| c.id.clone())
        .collect();
    let stored_ungrouped = db_groups::get_order(&state.db, "ungrouped")
        .await
        .unwrap_or(None)
        .map(|o| o.container_ids)
        .unwrap_or_default();
    let ungrouped_ids = apply_ordering(live_ungrouped, &stored_ungrouped);
    result.push(ContainerGroup {
        id: "ungrouped".to_string(),
        name: "Ungrouped".to_string(),
        kind: GroupKind::Ungrouped,
        locked: false,
        colour: None,
        container_ids: ungrouped_ids,
    });

    // Apply stored group display order — groups not present in the stored list are appended.
    let stored_order = db_groups::get_group_display_order(&state.db).await.unwrap_or_default();
    if !stored_order.is_empty() {
        let order_map: HashMap<&str, usize> = stored_order
            .iter()
            .enumerate()
            .map(|(i, id)| (id.as_str(), i))
            .collect();
        result.sort_by_key(|g| order_map.get(g.id.as_str()).copied().unwrap_or(usize::MAX));
    }

    Ok(Json(result))
}

async fn create_group_handler(
    State(state): State<AppState>,
    Json(body): Json<CreateGroupBody>,
) -> Result<Json<db_groups::CustomGroup>, AppError> {
    let group = db_groups::create_group(&state.db, &body.name).await?;
    // Prepend the new group to the display order so it appears at the top.
    let mut order = db_groups::get_group_display_order(&state.db).await.unwrap_or_default();
    order.insert(0, group.group_id.clone());
    let _ = db_groups::set_group_display_order(&state.db, order).await;
    Ok(Json(group))
}

async fn rename_group_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(body): Json<UpdateGroupBody>,
) -> Result<Json<db_groups::CustomGroup>, AppError> {
    let group = db_groups::update_group(
        &state.db,
        &id,
        body.name.as_deref(),
        body.colour.as_deref(),
    )
    .await?;
    Ok(Json(group))
}

async fn delete_group_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    db_groups::delete_group(&state.db, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn set_order_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(body): Json<SetOrderBody>,
) -> Result<StatusCode, AppError> {
    db_groups::set_order(&state.db, &id, body.container_ids).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn set_display_order_handler(
    State(state): State<AppState>,
    Json(body): Json<SetDisplayOrderBody>,
) -> Result<StatusCode, AppError> {
    db_groups::set_group_display_order(&state.db, body.group_ids).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn assign_container_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(body): Json<AssignContainerBody>,
) -> Result<StatusCode, AppError> {
    db_groups::assign_container(&state.db, &id, &body.container_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn unassign_container_handler(
    Path((_id, cid)): Path<(String, String)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    db_groups::unassign_container(&state.db, &cid).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn start_group_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let container_ids = resolve_group_container_ids(&id, &state).await?;

    let futures: Vec<_> = container_ids
        .into_iter()
        .map(|cid| {
            let podman = state.podman.clone();
            async move {
                let _ = podman
                    .start_container(&cid, None::<StartContainerOptions>)
                    .await;
            }
        })
        .collect();

    join_all(futures).await;
    Ok(StatusCode::NO_CONTENT)
}

async fn stop_group_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let container_ids = resolve_group_container_ids(&id, &state).await?;

    let futures: Vec<_> = container_ids
        .into_iter()
        .map(|cid| {
            let podman = state.podman.clone();
            async move {
                let _ = podman
                    .stop_container(&cid, Some(StopContainerOptions { t: Some(10), ..Default::default() }))
                    .await;
            }
        })
        .collect();

    join_all(futures).await;
    Ok(StatusCode::NO_CONTENT)
}
