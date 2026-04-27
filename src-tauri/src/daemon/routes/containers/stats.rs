use crate::daemon::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use bollard::models::ContainerStatsResponse;
use bollard::query_parameters::StatsOptions;
use futures_util::StreamExt;
use serde::Serialize;

#[derive(Serialize)]
struct StatsSnapshot {
    cpu_percent: f64,
    memory_usage: u64,
    memory_limit: u64,
    memory_percent: f64,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/containers/{id}/stats", get(stats_ws))
        .route("/containers/{id}/stats/snapshot", get(stats_snapshot))
}

async fn stats_ws(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| stream_stats(socket, id, state))
}

async fn stream_stats(mut socket: WebSocket, id: String, state: AppState) {
    let opts = StatsOptions {
        stream: true,
        one_shot: false,
    };

    let mut stream = state.podman.stats(&id, Some(opts));

    // First reading has no precpu_stats, so cpu_percent would be 0 — discard it.
    let _ = stream.next().await;

    while let Some(Ok(s)) = stream.next().await {
        let cpu_percent = calc_cpu_percent(&s);

        let memory_usage = s.memory_stats.as_ref().and_then(|m| m.usage).unwrap_or(0);
        let memory_limit = s.memory_stats.as_ref().and_then(|m| m.limit).unwrap_or(0);
        let memory_percent = if memory_limit == 0 {
            0.0
        } else {
            memory_usage as f64 / memory_limit as f64 * 100.0
        };

        let snapshot = StatsSnapshot {
            cpu_percent,
            memory_usage,
            memory_limit,
            memory_percent,
        };

        let Ok(text) = serde_json::to_string(&snapshot) else {
            continue;
        };

        if socket.send(Message::Text(text.into())).await.is_err() {
            break; // client disconnected
        }
    }
}

async fn stats_snapshot(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<StatsSnapshot>, (StatusCode, String)> {
    // CPU % requires two readings: the first has no precpu_stats (delta = 0).
    // Stream briefly, discard the first sample, use the second.
    let opts = StatsOptions {
        stream: true,
        one_shot: false,
    };

    let mut stream = state.podman.stats(&id, Some(opts));

    // Discard first reading — precpu_stats will be zero.
    let _ = stream.next().await;

    let snapshot = stream
        .next()
        .await
        .ok_or_else(|| (StatusCode::NOT_FOUND, "No stats available".to_string()))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let cpu_percent = calc_cpu_percent(&snapshot);
    let memory_usage = snapshot.memory_stats.as_ref().and_then(|m| m.usage).unwrap_or(0);
    let memory_limit = snapshot.memory_stats.as_ref().and_then(|m| m.limit).unwrap_or(0);
    let memory_percent = if memory_limit == 0 {
        0.0
    } else {
        memory_usage as f64 / memory_limit as f64 * 100.0
    };

    Ok(Json(StatsSnapshot {
        cpu_percent,
        memory_usage,
        memory_limit,
        memory_percent,
    }))
}

fn calc_cpu_percent(s: &ContainerStatsResponse) -> f64 {
    let cur_total = s
        .cpu_stats
        .as_ref()
        .and_then(|c| c.cpu_usage.as_ref())
        .and_then(|u| u.total_usage)
        .unwrap_or(0);
    let pre_total = s
        .precpu_stats
        .as_ref()
        .and_then(|c| c.cpu_usage.as_ref())
        .and_then(|u| u.total_usage)
        .unwrap_or(0);
    let cpu_delta = cur_total.saturating_sub(pre_total);

    let cur_sys = s.cpu_stats.as_ref().and_then(|c| c.system_cpu_usage).unwrap_or(0);
    let pre_sys = s.precpu_stats.as_ref().and_then(|c| c.system_cpu_usage).unwrap_or(0);
    let sys_delta = cur_sys.saturating_sub(pre_sys);

    let cpus = s.cpu_stats.as_ref().and_then(|c| c.online_cpus).unwrap_or(1) as f64;

    if sys_delta == 0 {
        0.0
    } else {
        (cpu_delta as f64 / sys_delta as f64) * cpus * 100.0
    }
}
