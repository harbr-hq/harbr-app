//! Background log collection daemon.
//!
//! `run()` is the entry point — spawn it as a detached Tokio task. It polls
//! `container_settings` every 30 seconds and maintains one collector task per
//! container that has `persistent_logs = true`. Each collector streams from
//! the Podman socket, batches lines (flush every 5 s or 200 lines, whichever
//! comes first), writes to SurrealDB, then enforces the configured retention
//! limit immediately after each flush.

use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use bollard::{container::LogOutput, query_parameters::LogsOptions};
use bollard::Docker;
use futures_util::StreamExt;
use surrealdb::{engine::local::Db, Surreal};
use tokio::task::JoinHandle;
use tokio::time::interval;
use tokio_util::sync::CancellationToken;

use crate::db::{self, PersistenceSettings};

const MANAGER_POLL: Duration = Duration::from_secs(30);
const BATCH_TIMEOUT: Duration = Duration::from_secs(5);
const BATCH_MAX: usize = 200;

/// Manages per-container collector tasks. Runs until `shutdown` is cancelled.
pub async fn run(db: Surreal<Db>, podman: Docker, shutdown: CancellationToken) {
    let mut tasks: HashMap<String, JoinHandle<()>> = HashMap::new();
    let mut tick = interval(MANAGER_POLL);
    tick.tick().await; // Consume the immediate first tick — wait a full interval before polling.

    loop {
        tokio::select! {
            _ = shutdown.cancelled() => {
                tracing::info!("Log collector manager: shutdown signal received");
                break;
            }
            _ = tick.tick() => {}
        }

        let enabled = match db::get_persistent_containers(&db).await {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("Log collector manager: failed to read settings: {e:#}");
                continue;
            }
        };

        let enabled_ids: HashSet<&str> =
            enabled.iter().map(|s| s.container_id.as_str()).collect();

        // Abort tasks whose container has persistence disabled (or finished on its own).
        tasks.retain(|id, handle| {
            if !enabled_ids.contains(id.as_str()) {
                handle.abort();
                tracing::info!("Log collector: stopped for {id}");
                false
            } else if handle.is_finished() {
                // Task ended (container stopped, socket error, etc.) — remove so it
                // gets restarted on the next manager poll.
                false
            } else {
                true
            }
        });

        // Spawn collectors for enabled containers that don't have a running task.
        for settings in enabled {
            let id = settings.container_id.clone();
            if tasks.contains_key(&id) {
                continue;
            }
            tracing::info!("Log collector: starting for {id}");
            let handle = tokio::spawn(collect(db.clone(), podman.clone(), settings));
            tasks.insert(id, handle);
        }
    }

    // Abort all running collector tasks then wait for them to finish.
    for (id, handle) in &tasks {
        handle.abort();
        tracing::info!("Log collector: stopped for {id}");
    }
    for (_, handle) in tasks {
        let _ = handle.await;
    }
    tracing::info!("Log collector manager: stopped");
}

/// Stream logs for a single container and persist them in batches.
async fn collect(db: Surreal<Db>, podman: Docker, settings: PersistenceSettings) {
    let id = &settings.container_id;

    // Only collect lines produced from this moment forward — avoids duplicating
    // logs that were already persisted in a previous run.
    let since = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let options = LogsOptions {
        follow: true,
        stdout: true,
        stderr: true,
        since: since as i32,
        tail: "0".to_string(),
        ..Default::default()
    };

    let mut stream = podman.logs(id, Some(options));
    let mut batch: Vec<db::LogEntry> = Vec::with_capacity(BATCH_MAX);
    let mut tick = interval(BATCH_TIMEOUT);
    tick.tick().await; // Skip immediate tick.

    loop {
        tokio::select! {
            maybe = stream.next() => {
                match maybe {
                    Some(Ok(log)) => {
                        let (stream_name, bytes) = match log {
                            LogOutput::StdOut { message } => ("stdout", message),
                            LogOutput::StdErr { message } => ("stderr", message),
                            _ => continue,
                        };

                        let line = String::from_utf8_lossy(&bytes)
                            .trim_end_matches('\n')
                            .to_string();

                        if line.is_empty() {
                            continue;
                        }

                        batch.push(db::LogEntry {
                            container_id: id.clone(),
                            stream: stream_name.to_string(),
                            line,
                        });

                        if batch.len() >= BATCH_MAX {
                            flush(&db, &settings, &mut batch).await;
                        }
                    }
                    Some(Err(e)) => {
                        tracing::debug!("Log stream ended for {id}: {e}");
                        break;
                    }
                    None => break,
                }
            }
            _ = tick.tick() => {
                if !batch.is_empty() {
                    flush(&db, &settings, &mut batch).await;
                }
            }
        }
    }

    // Final flush for any lines buffered before the stream closed.
    if !batch.is_empty() {
        flush(&db, &settings, &mut batch).await;
    }
}

/// Write a batch to SurrealDB then immediately enforce retention limits.
async fn flush(db: &Surreal<Db>, settings: &PersistenceSettings, batch: &mut Vec<db::LogEntry>) {
    let id = &settings.container_id;
    let lines = std::mem::take(batch);
    let count = lines.len();

    if let Err(e) = db::insert_logs(db, &lines).await {
        tracing::warn!("Log collector: insert failed for {id}: {e:#}");
        return;
    }

    tracing::debug!("Log collector: persisted {count} lines for {id}");

    // Enforce retention immediately so disk usage stays bounded.
    let result = match settings.retention_type.as_str() {
        "days" => db::prune_by_days(db, id, settings.retention_days.unwrap_or(30)).await,
        _ => db::prune_by_size(db, id, settings.retention_mb).await,
    };

    if let Err(e) = result {
        tracing::warn!("Log collector: retention pruning failed for {id}: {e:#}");
    }
}
