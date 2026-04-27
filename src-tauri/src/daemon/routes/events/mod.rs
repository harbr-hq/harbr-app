use crate::daemon::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use bollard::query_parameters::EventsOptions;
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Serialize)]
pub struct PodmanEvent {
    /// "container", "image", "volume", "network", "daemon", etc.
    pub typ: String,
    /// "start", "stop", "die", "create", "remove", "pull", etc.
    pub action: String,
    /// Container short ID, image digest, or volume/network name.
    pub actor_id: String,
    /// Human-readable name — container name, image tag, volume/network name.
    pub actor_name: String,
    /// Unix timestamp (seconds).
    pub timestamp: i64,
    /// Extra attributes from the event (e.g. exitCode, image name on container events).
    pub attributes: HashMap<String, String>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/events", get(events_ws))
}

async fn events_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| stream_events(socket, state))
}

async fn stream_events(mut socket: WebSocket, state: AppState) {
    let mut stream = state
        .podman
        .events(Some(EventsOptions::default()));

    while let Some(result) = stream.next().await {
        let msg = match result {
            Ok(ev) => ev,
            Err(e) => {
                tracing::warn!("Podman events stream error: {e}");
                break;
            }
        };

        let typ = msg
            .typ
            .as_ref()
            .map(|t| format!("{t:?}").to_lowercase())
            .unwrap_or_default();

        let action = msg.action.clone().unwrap_or_default();
        let timestamp = msg.time.unwrap_or(0);

        let (actor_id, attributes) = match msg.actor {
            Some(actor) => {
                let id = actor.id.unwrap_or_default();
                let attrs = actor.attributes.unwrap_or_default();
                (id, attrs)
            }
            None => (String::new(), HashMap::new()),
        };

        // Derive a human-readable name from the attributes map.
        // Containers have a "name" attr; images use "name" too; volumes/networks
        // typically have no name attr so fall back to the actor ID.
        let actor_name = attributes
            .get("name")
            .cloned()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                // Short IDs for containers (first 12 chars), full for others.
                if typ == "container" && actor_id.len() > 12 {
                    actor_id[..12].to_string()
                } else {
                    actor_id.clone()
                }
            });

        let event = PodmanEvent {
            typ,
            action,
            actor_id,
            actor_name,
            timestamp,
            attributes,
        };

        let Ok(text) = serde_json::to_string(&event) else {
            continue;
        };

        if socket.send(Message::Text(text.into())).await.is_err() {
            break; // client disconnected
        }
    }
}
