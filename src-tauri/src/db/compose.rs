use anyhow::Context;
use serde::{Deserialize, Serialize};
use surrealdb::{engine::local::Db, Surreal};
use surrealdb::types::{RecordId, SurrealValue};

/// Metadata for a compose file tracked by Harbr.
#[derive(Debug, Serialize, Deserialize, Clone, SurrealValue)]
pub struct ComposeFileMeta {
    pub name: String,
    pub path: String,
    /// Optional working directory used as cwd when spawning compose operations.
    /// Relative paths in the compose file (e.g. bind mounts) are resolved from here.
    pub working_dir: Option<String>,
}

#[derive(Debug, Deserialize, SurrealValue)]
struct ComposeFileRecord {
    #[allow(dead_code)]
    id: RecordId,
    name: String,
    path: String,
    working_dir: Option<String>,
}

impl From<ComposeFileRecord> for ComposeFileMeta {
    fn from(r: ComposeFileRecord) -> Self {
        Self { name: r.name, path: r.path, working_dir: r.working_dir }
    }
}

pub async fn upsert_file_meta(
    db: &Surreal<Db>,
    name: &str,
    path: &str,
    working_dir: Option<&str>,
) -> anyhow::Result<ComposeFileMeta> {
    let meta = ComposeFileMeta {
        name: name.to_string(),
        path: path.to_string(),
        working_dir: working_dir.map(String::from),
    };
    let _: Option<ComposeFileMeta> = db
        .upsert(("compose_files", name))
        .content(meta.clone())
        .await
        .with_context(|| format!("DB upsert failed for compose_files:{name}"))?;
    Ok(meta)
}

pub async fn list_file_metas(db: &Surreal<Db>) -> anyhow::Result<Vec<ComposeFileMeta>> {
    let records: Vec<ComposeFileRecord> = db
        .select("compose_files")
        .await
        .context("DB select failed for compose_files")?;
    Ok(records.into_iter().map(ComposeFileMeta::from).collect())
}

pub async fn get_file_meta(db: &Surreal<Db>, name: &str) -> anyhow::Result<Option<ComposeFileMeta>> {
    let record: Option<ComposeFileRecord> = db
        .select(("compose_files", name))
        .await
        .with_context(|| format!("DB select failed for compose_files:{name}"))?;
    Ok(record.map(ComposeFileMeta::from))
}

pub async fn delete_file_meta(db: &Surreal<Db>, name: &str) -> anyhow::Result<()> {
    let _: Option<ComposeFileRecord> = db
        .delete(("compose_files", name))
        .await
        .with_context(|| format!("DB delete failed for compose_files:{name}"))?;
    Ok(())
}
