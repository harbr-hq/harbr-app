use crate::daemon::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use bollard::{container::LogOutput, query_parameters::LogsOptions};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct LogMessage {
    stream: &'static str,
    line: String,
}

#[derive(Deserialize, Default)]
struct LogsQuery {
    /// Case-insensitive substring filter. Applied server-side to reduce noise on
    /// high-volume containers. The frontend also filters for live wildcard display.
    filter: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/containers/{id}/logs", get(logs_ws))
}

async fn logs_ws(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    Query(query): Query<LogsQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| stream_logs(socket, id, state, query.filter))
}

async fn stream_logs(
    mut socket: WebSocket,
    id: String,
    state: AppState,
    filter: Option<String>,
) {
    let opts = LogsOptions {
        follow: true,
        stdout: true,
        stderr: true,
        tail: "200".to_string(),
        ..Default::default()
    };

    let mut stream = state.podman.logs(&id, Some(opts));
    // Pre-lowercase once — cheaper than allocating per line.
    let filter_lower = filter.as_deref().map(str::to_lowercase);

    while let Some(Ok(log)) = stream.next().await {
        let msg = match log {
            LogOutput::StdOut { message } => LogMessage {
                stream: "stdout",
                line: String::from_utf8_lossy(&message).to_string(),
            },
            LogOutput::StdErr { message } => LogMessage {
                stream: "stderr",
                line: String::from_utf8_lossy(&message).to_string(),
            },
            _ => continue,
        };

        // Skip lines that don't contain the filter string.
        if let Some(ref f) = filter_lower {
            if !msg.line.to_lowercase().contains(f.as_str()) {
                continue;
            }
        }

        let Ok(text) = serde_json::to_string(&msg) else {
            continue;
        };

        if socket.send(Message::Text(text.into())).await.is_err() {
            break; // client disconnected
        }
    }
}
