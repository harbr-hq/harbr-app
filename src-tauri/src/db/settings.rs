use anyhow::Context;
use serde::{Deserialize, Serialize};
use surrealdb::{engine::local::Db, Surreal};
use surrealdb::types::{RecordId, SurrealValue};

/// Per-container persistence settings — the single source of truth for this
/// type across both the DB layer and the HTTP API layer.
#[derive(Debug, Serialize, Deserialize, Clone, SurrealValue)]
pub struct ContainerSettings {
    pub container_id: String,
    pub persistent_logs: bool,
    /// `"size"` or `"days"`
    pub retention_type: String,
    pub retention_days: Option<i64>,
    pub retention_mb: i64,
}

/// Internal SurrealDB row representation (includes the auto-generated record id).
#[derive(Debug, Deserialize, SurrealValue)]
struct SettingsRecord {
    #[allow(dead_code)]
    id: RecordId,
    container_id: String,
    persistent_logs: bool,
    retention_type: String,
    retention_days: Option<i64>,
    retention_mb: i64,
}

impl From<SettingsRecord> for ContainerSettings {
    fn from(r: SettingsRecord) -> Self {
        Self {
            container_id: r.container_id,
            persistent_logs: r.persistent_logs,
            retention_type: r.retention_type,
            retention_days: r.retention_days,
            retention_mb: r.retention_mb,
        }
    }
}

fn defaults(container_id: &str) -> ContainerSettings {
    ContainerSettings {
        container_id: container_id.to_string(),
        persistent_logs: false,
        retention_type: "size".to_string(),
        retention_days: None,
        retention_mb: 250,
    }
}

/// Fetch settings for a container. Returns schema defaults when no record exists yet.
pub async fn get(db: &Surreal<Db>, container_id: &str) -> anyhow::Result<ContainerSettings> {
    let record: Option<SettingsRecord> = db
        .select(("container_settings", container_id))
        .await
        .with_context(|| format!("DB select failed for container_settings:{container_id}"))?;

    Ok(record.map(ContainerSettings::from).unwrap_or_else(|| defaults(container_id)))
}

/// Create or update settings for a container.
///
/// Uses the container ID as the SurrealDB record ID so UPSERT always targets
/// the same row — no duplicate records, no stale reads after navigation.
pub async fn upsert(
    db: &Surreal<Db>,
    container_id: &str,
    settings: &ContainerSettings,
) -> anyhow::Result<ContainerSettings> {
    // Pass the struct directly — SurrealDB's SDK serialiser handles Serialize impls
    // natively. serde_json::Value (a Rust enum) causes "invalid type: enum" errors.
    let _: Option<ContainerSettings> = db
        .upsert(("container_settings", container_id))
        .content(settings.clone())
        .await
        .with_context(|| format!("DB upsert failed for container_settings:{container_id}"))?;

    Ok(settings.clone())
}
