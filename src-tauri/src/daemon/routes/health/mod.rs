use crate::daemon::AppState;
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use std::collections::HashMap;

use super::containers::crud::{fetch_containers, ContainerStatus};

#[derive(Serialize)]
pub struct HealthStatus {
    pub podman_connected: bool,
    pub running_count: u32,
    pub port_conflict_count: u32,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health))
}

async fn health(State(state): State<AppState>) -> Json<HealthStatus> {
    match fetch_containers(&state.podman).await {
        Ok(containers) => {
            let mut port_counts: HashMap<u16, u32> = HashMap::new();
            let mut running_count = 0u32;

            for c in &containers {
                if matches!(c.status, ContainerStatus::Running) {
                    running_count += 1;
                    for port_str in &c.ports {
                        if let Some(host_part) = port_str.split(':').next() {
                            if let Ok(port) = host_part.parse::<u16>() {
                                *port_counts.entry(port).or_insert(0) += 1;
                            }
                        }
                    }
                }
            }

            let port_conflict_count =
                port_counts.values().filter(|&&n| n > 1).count() as u32;

            Json(HealthStatus {
                podman_connected: true,
                running_count,
                port_conflict_count,
            })
        }
        Err(_) => Json(HealthStatus {
            podman_connected: false,
            running_count: 0,
            port_conflict_count: 0,
        }),
    }
}
