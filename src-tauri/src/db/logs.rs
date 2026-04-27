use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use surrealdb::{engine::local::Db, Surreal};
use surrealdb::types::SurrealValue;

/// Container settings row, as needed by the log collector to know which
/// containers to tail and what retention policy to apply.
#[derive(Debug, Deserialize, Clone, SurrealValue)]
pub struct PersistenceSettings {
    pub container_id: String,
    pub retention_type: String,
    pub retention_days: Option<i64>,
    pub retention_mb: i64,
}

/// A single log line ready for insertion.
#[derive(Debug, Serialize, Clone)]
pub struct LogEntry {
    pub container_id: String,
    pub stream: String,
    pub line: String,
}

/// Returns all containers that have persistent logging enabled.
pub async fn get_persistent_containers(
    db: &Surreal<Db>,
) -> anyhow::Result<Vec<PersistenceSettings>> {
    let mut result = db
        .query(
            "SELECT container_id, retention_type, retention_days, retention_mb \
             FROM container_settings WHERE persistent_logs = true",
        )
        .await
        .context("Failed to query persistent containers")?;

    let settings: Vec<PersistenceSettings> = result.take(0)?;
    Ok(settings)
}

/// Insert a batch of log lines into `container_logs` in a single transaction.
pub async fn insert_logs(db: &Surreal<Db>, entries: &[LogEntry]) -> anyhow::Result<()> {
    if entries.is_empty() {
        return Ok(());
    }

    // Build one transaction with N CREATE statements, each using numbered params
    // ($cid0/$stream0/$line0, $cid1/…) to avoid repeated round-trips.
    // Raw SQL is used throughout to avoid SurrealDB SDK enum deserialisation issues.
    let mut sql = String::from("BEGIN TRANSACTION;\n");
    for i in 0..entries.len() {
        sql.push_str(&format!(
            "CREATE container_logs SET container_id = $cid{i}, stream = $stream{i}, line = $line{i};\n"
        ));
    }
    sql.push_str("COMMIT TRANSACTION;");

    let mut q = db.query(sql);
    for (i, entry) in entries.iter().enumerate() {
        q = q
            .bind((format!("cid{i}"), entry.container_id.clone()))
            .bind((format!("stream{i}"), entry.stream.clone()))
            .bind((format!("line{i}"), entry.line.clone()));
    }
    q.await.context("Failed to insert log batch")?;

    Ok(())
}

/// Prune oldest log lines for a container until total line bytes are under `max_mb`.
pub async fn prune_by_size(
    db: &Surreal<Db>,
    container_id: &str,
    max_mb: i64,
) -> anyhow::Result<()> {
    #[derive(Deserialize, Default, SurrealValue)]
    struct SizeRow {
        total: Option<i64>,
    }

    let max_bytes = max_mb.saturating_mul(1024).saturating_mul(1024);

    // Up to 20 delete passes (20 × 1 000 = 20 000 lines max deleted per flush).
    for _ in 0..20 {
        let mut r = db
            .query(
                "SELECT math::sum(string::len(line)) AS total \
                 FROM container_logs WHERE container_id = $cid GROUP ALL",
            )
            .bind(("cid", container_id.to_string()))
            .await?;

        let rows: Vec<SizeRow> = r.take(0)?;
        let current = rows.first().and_then(|r| r.total).unwrap_or(0);

        if current <= max_bytes {
            break;
        }

        // Delete oldest 1 000 records.
        db.query(
            "LET $ids = (SELECT VALUE id FROM container_logs \
                         WHERE container_id = $cid ORDER BY ts ASC LIMIT 1000); \
             DELETE $ids;",
        )
        .bind(("cid", container_id.to_string()))
        .await
        .context("Failed to prune logs by size")?;

        tracing::debug!("Pruned 1 000 log lines for {container_id} (size over {max_mb} MB)");
    }

    Ok(())
}

/// Prune log lines for a container that are older than `days` days.
pub async fn prune_by_days(
    db: &Surreal<Db>,
    container_id: &str,
    days: i64,
) -> anyhow::Result<()> {
    let cutoff_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .saturating_sub(days as u64 * 86_400);

    db.query(
        "DELETE container_logs \
         WHERE container_id = $cid AND time::unix(ts) < $cutoff",
    )
    .bind(("cid", container_id.to_string()))
    .bind(("cutoff", cutoff_secs))
    .await
    .context("Failed to prune logs by age")?;

    tracing::debug!("Pruned logs older than {days} days for {container_id}");

    Ok(())
}

/// Returns the distinct container IDs that have at least one log line stored.
pub async fn get_logged_container_ids(db: &Surreal<Db>) -> anyhow::Result<Vec<String>> {
    let mut result = db
        .query("SELECT VALUE container_id FROM container_logs")
        .await
        .context("Failed to query logged container IDs")?;

    let ids: Vec<String> = result.take(0)?;

    // Deduplicate while preserving a stable order.
    let mut seen = std::collections::HashSet::new();
    Ok(ids.into_iter().filter(|id| seen.insert(id.clone())).collect())
}
