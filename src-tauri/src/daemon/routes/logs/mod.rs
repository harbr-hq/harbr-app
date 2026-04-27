pub mod search;

use axum::{extract::State, http::StatusCode, routing::{delete, get}, Json, Router};
use serde::Serialize;

use crate::{daemon::{AppError, AppState}, db::logs as db_logs};

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(search::router())
        .route("/logs", delete(clear_all_logs))
        .route("/logs/containers", get(logged_containers))
}

#[derive(Serialize)]
struct LoggedContainersResponse {
    container_ids: Vec<String>,
}

/// Returns distinct container IDs that have at least one stored log line.
async fn logged_containers(
    State(state): State<AppState>,
) -> Result<Json<LoggedContainersResponse>, AppError> {
    let ids = db_logs::get_logged_container_ids(&state.db)
        .await
        .map_err(AppError::internal)?;
    Ok(Json(LoggedContainersResponse { container_ids: ids }))
}

/// Deletes all stored container logs from the local database.
async fn clear_all_logs(State(state): State<AppState>) -> Result<StatusCode, AppError> {
    state
        .db
        .query("DELETE container_logs")
        .await
        .map_err(AppError::internal)?;
    Ok(StatusCode::NO_CONTENT)
}
