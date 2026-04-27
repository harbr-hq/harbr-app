use anyhow::Context;
use std::path::PathBuf;
use surrealdb::{
    engine::local::{Db, SurrealKv},
    Surreal,
};

pub mod compose;
pub mod groups;
pub mod logs;
pub mod settings;

// Flatten types and functions so existing callers (log_collector etc.) don't need
// to change their import paths.
pub use logs::{
    get_persistent_containers, insert_logs, prune_by_days, prune_by_size, LogEntry,
    PersistenceSettings,
};

/// Initialise the embedded SurrealDB instance.
///
/// Opens (or creates) the database at `path`, selects the `harbr` namespace
/// and database, then runs idempotent schema definitions. Safe to call on
/// every startup — all statements use `IF NOT EXISTS`.
pub async fn init(path: PathBuf) -> anyhow::Result<Surreal<Db>> {
    tokio::fs::create_dir_all(&path)
        .await
        .with_context(|| format!("Failed to create DB directory at {}", path.display()))?;

    let db = Surreal::new::<SurrealKv>(path.clone())
        .await
        .with_context(|| format!("Failed to open SurrealDB at {}", path.display()))?;

    db.use_ns("harbr")
        .use_db("harbr")
        .await
        .context("Failed to select SurrealDB namespace/database")?;

    tracing::info!("SurrealDB opened at {}", path.display());

    apply_schema(&db).await?;

    Ok(db)
}

/// Apply schema definitions. All statements are idempotent — safe to re-run
/// on every startup without data loss. Add new definitions here as the schema
/// evolves; never drop or alter existing fields in place.
async fn apply_schema(db: &Surreal<Db>) -> anyhow::Result<()> {
    db.query(
        "
        -- Drop updated_at if it exists from an earlier schema version that used
        -- VALUE time::now(), which conflicts with SDK CONTENT operations.
        REMOVE FIELD IF EXISTS updated_at ON TABLE container_settings;

        -- Per-container settings. One record per container ID.
        DEFINE TABLE IF NOT EXISTS container_settings SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS container_id    ON TABLE container_settings TYPE string;
        DEFINE FIELD IF NOT EXISTS persistent_logs ON TABLE container_settings TYPE bool    DEFAULT false;
        DEFINE FIELD IF NOT EXISTS retention_type  ON TABLE container_settings TYPE string  DEFAULT 'size';
        DEFINE FIELD IF NOT EXISTS retention_days  ON TABLE container_settings TYPE option<int>;
        DEFINE FIELD IF NOT EXISTS retention_mb    ON TABLE container_settings TYPE int     DEFAULT 250;
        DEFINE INDEX IF NOT EXISTS container_settings_id_idx
            ON TABLE container_settings COLUMNS container_id UNIQUE;

        -- Persistent log lines.
        DEFINE TABLE IF NOT EXISTS container_logs SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS container_id ON TABLE container_logs TYPE string;
        DEFINE FIELD IF NOT EXISTS stream       ON TABLE container_logs TYPE string; -- 'stdout' | 'stderr'
        DEFINE FIELD IF NOT EXISTS line         ON TABLE container_logs TYPE string;
        DEFINE FIELD IF NOT EXISTS ts           ON TABLE container_logs TYPE datetime DEFAULT time::now();
        DEFINE INDEX IF NOT EXISTS container_logs_ts_idx
            ON TABLE container_logs COLUMNS container_id, ts;

        -- Full-text search on log lines (BM25 relevance).
        DEFINE ANALYZER IF NOT EXISTS log_analyzer TOKENIZERS blank FILTERS lowercase, ascii;
        DEFINE INDEX IF NOT EXISTS container_logs_fts_idx
            ON TABLE container_logs FIELDS line
            FULLTEXT ANALYZER log_analyzer BM25;

        -- User-created container groups.
        DEFINE TABLE IF NOT EXISTS container_groups SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS group_id       ON TABLE container_groups TYPE string;
        DEFINE FIELD IF NOT EXISTS name           ON TABLE container_groups TYPE string;
        DEFINE FIELD IF NOT EXISTS colour         ON TABLE container_groups TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS container_ids  ON TABLE container_groups TYPE array<string> DEFAULT [];
        DEFINE INDEX IF NOT EXISTS container_groups_id_idx
            ON TABLE container_groups COLUMNS group_id UNIQUE;

        -- Stored orderings for compose / custom / ungrouped groups.
        DEFINE TABLE IF NOT EXISTS container_group_order SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS order_key      ON TABLE container_group_order TYPE string;
        DEFINE FIELD IF NOT EXISTS container_ids  ON TABLE container_group_order TYPE array<string> DEFAULT [];
        DEFINE INDEX IF NOT EXISTS container_group_order_key_idx
            ON TABLE container_group_order COLUMNS order_key UNIQUE;

        -- Compose file metadata tracked by Harbr.
        DEFINE TABLE IF NOT EXISTS compose_files SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS name ON TABLE compose_files TYPE string;
        DEFINE FIELD IF NOT EXISTS path ON TABLE compose_files TYPE string;
        DEFINE FIELD IF NOT EXISTS working_dir ON TABLE compose_files TYPE option<string>;
        DEFINE INDEX IF NOT EXISTS compose_files_name_idx
            ON TABLE compose_files COLUMNS name UNIQUE;
        ",
    )
    .await
    .context("Failed to apply DB schema")?;

    tracing::debug!("DB schema applied");

    Ok(())
}

/// Derive the default DB path from the OS data directory.
/// Linux:   ~/.local/share/harbr/db
/// macOS:   ~/Library/Application Support/harbr/db
/// Windows: %APPDATA%\harbr\db
pub fn default_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("harbr")
        .join("db")
}
