use crate::daemon::{AppError, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use bollard::{models::NetworkCreateRequest, query_parameters::{ListNetworksOptions, PruneNetworksOptions}};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Response types ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Network {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    /// First subnet in IPAM config, e.g. "172.17.0.0/16".
    pub subnet: Option<String>,
    /// First gateway in IPAM config, e.g. "172.17.0.1".
    pub gateway: Option<String>,
    pub internal: bool,
    pub created: Option<String>,
    pub container_count: usize,
    pub labels: HashMap<String, String>,
    pub containers: Vec<NetworkMember>,
}

#[derive(Debug, Serialize)]
pub struct NetworkMember {
    pub id: String,
    pub name: String,
    pub ipv4_address: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PruneResult {
    pub deleted_count: usize,
}

// ─── Request types ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateNetworkBody {
    pub name: String,
    #[serde(default = "default_driver")]
    pub driver: String,
}

fn default_driver() -> String {
    "bridge".to_string()
}

// ─── Router ────────────────────────────────────────────────────────────────

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/networks", get(list_networks).post(create_network))
        // Static path before :id.
        .route("/networks/prune", post(prune_networks))
        .route("/networks/{id}", delete(remove_network))
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async fn list_networks(
    State(state): State<AppState>,
) -> Result<Json<Vec<Network>>, AppError> {
    let raw = state
        .podman
        .list_networks(None::<ListNetworksOptions>)
        .await?;

    let networks = raw
        .into_iter()
        .map(|n| {
            let first_ipam = n
                .ipam
                .as_ref()
                .and_then(|i| i.config.as_ref())
                .and_then(|c| c.first());

            // bollard 0.20 Network struct does not expose attached containers.
            let containers: Vec<NetworkMember> = Vec::new();

            Network {
                id: n.id.unwrap_or_default(),
                name: n.name.unwrap_or_default(),
                driver: n.driver.unwrap_or_default(),
                scope: n.scope.unwrap_or_default(),
                subnet: first_ipam.and_then(|c| c.subnet.clone()),
                gateway: first_ipam.and_then(|c| c.gateway.clone()),
                internal: n.internal.unwrap_or(false),
                created: n.created,
                container_count: containers.len(),
                labels: n.labels.unwrap_or_default(),
                containers,
            }
        })
        .collect();

    Ok(Json(networks))
}

async fn create_network(
    State(state): State<AppState>,
    Json(body): Json<CreateNetworkBody>,
) -> Result<StatusCode, AppError> {
    state
        .podman
        .create_network(NetworkCreateRequest {
            name: body.name,
            driver: Some(body.driver),
            ..Default::default()
        })
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn remove_network(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    state.podman.remove_network(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn prune_networks(
    State(state): State<AppState>,
) -> Result<Json<PruneResult>, AppError> {
    let response = state
        .podman
        .prune_networks(None::<PruneNetworksOptions>)
        .await?;

    let deleted_count = response.networks_deleted.as_ref().map(Vec::len).unwrap_or(0);

    Ok(Json(PruneResult { deleted_count }))
}
