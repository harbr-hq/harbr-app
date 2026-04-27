use crate::daemon::{AppError, AppState};
use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use surrealdb::types::SurrealValue;

pub fn router() -> Router<AppState> {
    Router::new().route("/logs/search", post(search))
}

/// Request body for `POST /api/v1/logs/search`.
#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    /// Full-text search term. Empty / absent means match all lines.
    pub term: Option<String>,
    /// Container IDs to restrict results to. Empty = all containers.
    pub container_ids: Vec<String>,
    /// `"stdout"`, `"stderr"`, or `"all"` (default).
    pub stream: Option<String>,
    /// Unix epoch seconds cutoff — only return logs at or after this time.
    pub since_secs: Option<u64>,
    /// Max records to return. Capped at 500.
    pub limit: Option<u32>,
    /// Pagination offset.
    pub offset: Option<u32>,
    /// `"desc"` (newest first, default) or `"asc"` (oldest first).
    pub order: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, SurrealValue)]
pub struct LogSearchResult {
    pub container_id: String,
    pub stream: String,
    pub line: String,
    /// ISO 8601 timestamp string from SurrealDB.
    pub ts: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<LogSearchResult>,
    /// True when the result set is exactly `limit` records — there may be more.
    pub has_more: bool,
}

async fn search(
    State(state): State<AppState>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, AppError> {
    let limit = req.limit.unwrap_or(100).min(500) as usize;
    // Fetch one extra record so we can detect whether another page exists
    // without a separate COUNT query.
    let fetch_limit = limit + 1;
    let offset = req.offset.unwrap_or(0);
    let ts_dir = if req.order.as_deref() == Some("asc") { "ASC" } else { "DESC" };

    let has_term       = req.term.as_ref().is_some_and(|t| !t.trim().is_empty());
    let has_containers = !req.container_ids.is_empty();
    let has_stream     = req.stream.as_ref().is_some_and(|s| s != "all");
    let has_since      = req.since_secs.is_some_and(|s| s > 0);

    let mut conditions: Vec<&str> = Vec::new();
    // Case-insensitive substring match — exact string the user typed, not token soup.
    if has_term       { conditions.push("string::lowercase(line) CONTAINS string::lowercase($term)"); }
    if has_containers { conditions.push("container_id IN $cids"); }
    if has_stream     { conditions.push("stream = $stream"); }
    if has_since      { conditions.push("time::unix(ts) >= $since"); }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let ql = format!(
        "SELECT container_id, stream, line, ts \
         FROM container_logs \
         {where_clause} \
         ORDER BY ts {ts_dir} \
         LIMIT {fetch_limit} \
         START {offset}"
    );

    let mut q = state.db.query(ql);
    if has_term       { q = q.bind(("term",   req.term.clone().unwrap())); }
    if has_containers { q = q.bind(("cids",   req.container_ids.clone())); }
    if has_stream     { q = q.bind(("stream", req.stream.clone().unwrap())); }
    if has_since      { q = q.bind(("since",  req.since_secs.unwrap())); }

    let mut result = q
        .await
        .inspect_err(|e| tracing::error!("Log search query failed: {e:#}"))
        .map_err(AppError::internal)?;

    let results: Vec<LogSearchResult> = result
        .take(0)
        .inspect_err(|e| tracing::error!("Log search deserialise failed: {e:#}"))
        .map_err(AppError::internal)?;

    let has_more = results.len() > limit;
    let results = results.into_iter().take(limit).collect();

    Ok(Json(SearchResponse { results, has_more }))
}
