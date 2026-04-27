use crate::daemon::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use bollard::{
    container::LogOutput,
    exec::{CreateExecOptions, ResizeExecOptions, StartExecOptions, StartExecResults},
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::io::AsyncWriteExt;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ClientMsg {
    Resize { cols: u16, rows: u16 },
}

pub fn router() -> Router<AppState> {
    Router::new().route("/containers/{id}/exec", get(exec_ws))
}

async fn exec_ws(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_exec(socket, id, state))
}

async fn handle_exec(socket: WebSocket, id: String, state: AppState) {
    let exec = match state
        .podman
        .create_exec(
            &id,
            CreateExecOptions {
                cmd: Some(vec!["/bin/sh".to_string()]),
                attach_stdin: Some(true),
                attach_stdout: Some(true),
                attach_stderr: Some(true),
                tty: Some(true),
                ..Default::default()
            },
        )
        .await
    {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("create_exec failed: {e}");
            return;
        }
    };

    let exec_id = exec.id;

    let (mut exec_input, mut exec_output) = match state
        .podman
        .start_exec(
            &exec_id,
            Some(StartExecOptions {
                detach: false,
                ..Default::default()
            }),
        )
        .await
    {
        Ok(StartExecResults::Attached { input, output }) => (input, output),
        Ok(StartExecResults::Detached) => return,
        Err(e) => {
            tracing::error!("start_exec failed: {e}");
            return;
        }
    };

    let (mut ws_tx, mut ws_rx) = socket.split();
    let exec_id_clone = exec_id.clone();
    let podman_clone = state.podman.clone();

    // WS → exec stdin; text frames carry resize events
    tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            match msg {
                Message::Binary(data)
                    if exec_input.write_all(&data).await.is_err() =>
                {
                    break;
                }
                Message::Text(text) => {
                    if let Ok(ClientMsg::Resize { cols, rows }) = serde_json::from_str(&text) {
                        let _ = podman_clone
                            .resize_exec(
                                &exec_id_clone,
                                ResizeExecOptions {
                                    height: rows,
                                    width: cols,
                                },
                            )
                            .await;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // exec stdout → WS as raw binary (xterm.js handles the terminal sequences)
    while let Some(Ok(chunk)) = exec_output.next().await {
        let bytes = match chunk {
            LogOutput::Console { message }
            | LogOutput::StdOut { message }
            | LogOutput::StdErr { message } => message,
            _ => continue,
        };
        if ws_tx.send(Message::Binary(bytes)).await.is_err() {
            break;
        }
    }
}
