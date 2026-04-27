use crate::{daemon::{AppError, AppState}, db::settings::ContainerSettings};
use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;

/// Payload accepted by PUT. All fields optional — omitted fields keep their current values.
#[derive(Debug, Deserialize)]
pub struct UpdateSettings {
    pub persistent_logs: Option<bool>,
    pub retention_type: Option<String>,
    pub retention_days: Option<i64>,
    pub retention_mb: Option<i64>,
}

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/containers/{id}/settings",
        get(get_settings).put(put_settings),
    )
}

/// `GET /containers/{id}/settings`
async fn get_settings(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ContainerSettings>, AppError> {
    let settings = crate::db::settings::get(&state.db, &id)
        .await
        .inspect_err(|e| tracing::error!("settings get({id}): {e:#}"))?;
    Ok(Json(settings))
}

/// `PUT /containers/{id}/settings`
async fn put_settings(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSettings>,
) -> Result<Json<ContainerSettings>, AppError> {
    // Read existing to merge the partial update over the top.
    let base = crate::db::settings::get(&state.db, &id)
        .await
        .inspect_err(|e| tracing::error!("settings get({id}): {e:#}"))?;

    let merged = ContainerSettings {
        container_id: id.clone(),
        persistent_logs: body.persistent_logs.unwrap_or(base.persistent_logs),
        retention_type: body.retention_type.unwrap_or(base.retention_type),
        retention_days: body.retention_days.or(base.retention_days),
        retention_mb: body.retention_mb.unwrap_or(base.retention_mb),
    };

    let saved = crate::db::settings::upsert(&state.db, &id, &merged)
        .await
        .inspect_err(|e| tracing::error!("settings upsert({id}): {e:#}"))?;
    Ok(Json(saved))
}
