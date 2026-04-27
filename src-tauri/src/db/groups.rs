use anyhow::Context;
use serde::{Deserialize, Serialize};
use surrealdb::{engine::local::Db, Surreal};
use surrealdb::types::{RecordId, SurrealValue};
use uuid::Uuid;

/// A user-created container group.
#[derive(Debug, Serialize, Deserialize, Clone, SurrealValue)]
pub struct CustomGroup {
    pub group_id: String,
    pub name: String,
    pub colour: Option<String>,
    pub container_ids: Vec<String>,
}

/// Stored ordering for any group (compose or custom).
/// `order_key` format: `"compose:{project}"` or `"custom:{uuid}"` or `"ungrouped"`.
#[derive(Debug, Serialize, Deserialize, Clone, SurrealValue)]
pub struct GroupOrder {
    pub order_key: String,
    pub container_ids: Vec<String>,
}

/// Internal SurrealDB row for `container_groups`.
#[derive(Debug, Deserialize, SurrealValue)]
struct GroupRecord {
    #[allow(dead_code)]
    id: RecordId,
    group_id: String,
    name: String,
    colour: Option<String>,
    container_ids: Vec<String>,
}

/// Internal SurrealDB row for `container_group_order`.
#[derive(Debug, Deserialize, SurrealValue)]
struct OrderRecord {
    #[allow(dead_code)]
    id: RecordId,
    order_key: String,
    container_ids: Vec<String>,
}

impl From<GroupRecord> for CustomGroup {
    fn from(r: GroupRecord) -> Self {
        Self {
            group_id: r.group_id,
            name: r.name,
            colour: r.colour,
            container_ids: r.container_ids,
        }
    }
}

impl From<OrderRecord> for GroupOrder {
    fn from(r: OrderRecord) -> Self {
        Self {
            order_key: r.order_key,
            container_ids: r.container_ids,
        }
    }
}

/// Create a new custom group with a generated UUID.
pub async fn create_group(db: &Surreal<Db>, name: &str) -> anyhow::Result<CustomGroup> {
    let group_id = Uuid::new_v4().to_string();
    let group = CustomGroup {
        group_id: group_id.clone(),
        name: name.to_string(),
        colour: None,
        container_ids: Vec::new(),
    };
    let _: Option<CustomGroup> = db
        .upsert(("container_groups", &*group_id))
        .content(group.clone())
        .await
        .with_context(|| format!("DB upsert failed for container_groups:{group_id}"))?;
    Ok(group)
}

/// List all custom groups ordered by name.
pub async fn list_groups(db: &Surreal<Db>) -> anyhow::Result<Vec<CustomGroup>> {
    let mut response = db
        .query("SELECT * FROM container_groups ORDER BY name")
        .await
        .context("DB query failed for container_groups")?;
    let records: Vec<GroupRecord> = response
        .take(0)
        .context("Failed to deserialise container_groups")?;
    Ok(records.into_iter().map(CustomGroup::from).collect())
}

/// Fetch a single custom group by ID. Returns `None` if not found.
pub async fn get_group(db: &Surreal<Db>, id: &str) -> anyhow::Result<Option<CustomGroup>> {
    let record: Option<GroupRecord> = db
        .select(("container_groups", id))
        .await
        .with_context(|| format!("DB select failed for container_groups:{id}"))?;
    Ok(record.map(CustomGroup::from))
}

/// Update a custom group's name and/or colour. At least one must be provided.
pub async fn update_group(
    db: &Surreal<Db>,
    id: &str,
    name: Option<&str>,
    colour: Option<&str>,
) -> anyhow::Result<CustomGroup> {
    let existing = get_group(db, id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Group not found: {id}"))?;
    let updated = CustomGroup {
        name: name.map(str::to_string).unwrap_or(existing.name.clone()),
        colour: colour.map(str::to_string).or(existing.colour.clone()),
        ..existing
    };
    let _: Option<CustomGroup> = db
        .upsert(("container_groups", id))
        .content(updated.clone())
        .await
        .with_context(|| format!("DB upsert failed for container_groups:{id}"))?;
    Ok(updated)
}

/// Delete a custom group and its stored ordering record.
pub async fn delete_group(db: &Surreal<Db>, id: &str) -> anyhow::Result<()> {
    let _: Option<CustomGroup> = db
        .delete(("container_groups", id))
        .await
        .with_context(|| format!("DB delete failed for container_groups:{id}"))?;
    // Order is stored under the raw UUID (same key the frontend sends to setOrder).
    let _: Option<GroupOrder> = db
        .delete(("container_group_order", id))
        .await
        .with_context(|| format!("DB delete failed for container_group_order:{id}"))?;
    Ok(())
}

/// Assign a container to a custom group.
/// The container is first removed from any other custom group it belongs to.
/// Uses SDK read-modify-write to avoid silent failures with SurrealDB array functions.
pub async fn assign_container(
    db: &Surreal<Db>,
    group_id: &str,
    container_id: &str,
) -> anyhow::Result<()> {
    // Query only the groups that actually contain this container — avoids a
    // full table scan followed by in-process filtering.
    let mut res = db
        .query("SELECT * FROM container_groups WHERE $cid INSIDE container_ids")
        .bind(("cid", container_id.to_string()))
        .await
        .context("DB query failed searching groups for container")?;
    let affected: Vec<GroupRecord> = res.take(0).context("Failed to deserialise group records")?;

    for group in &affected {
        let new_ids: Vec<String> = group
            .container_ids
            .iter()
            .filter(|id| id.as_str() != container_id)
            .cloned()
            .collect();
        let updated = CustomGroup {
            group_id: group.group_id.clone(),
            name: group.name.clone(),
            colour: group.colour.clone(),
            container_ids: new_ids,
        };
        let _: Option<CustomGroup> = db
            .upsert(("container_groups", group.group_id.as_str()))
            .content(updated)
            .await
            .with_context(|| {
                format!(
                    "DB upsert failed removing container from group {}",
                    group.group_id
                )
            })?;
    }

    // Add to the target group.
    if let Some(mut target) = get_group(db, group_id).await? {
        if !target.container_ids.iter().any(|id| id == container_id) {
            target.container_ids.push(container_id.to_string());
        }
        let _: Option<CustomGroup> = db
            .upsert(("container_groups", group_id))
            .content(target)
            .await
            .with_context(|| {
                format!("DB upsert failed assigning container to group {group_id}")
            })?;
    }

    Ok(())
}

/// Remove a container from any custom group that contains it.
/// Uses SDK read-modify-write to avoid silent failures with SurrealDB array functions.
pub async fn unassign_container(db: &Surreal<Db>, container_id: &str) -> anyhow::Result<()> {
    let mut res = db
        .query("SELECT * FROM container_groups WHERE $cid INSIDE container_ids")
        .bind(("cid", container_id.to_string()))
        .await
        .context("DB query failed searching groups for container")?;
    let affected: Vec<GroupRecord> = res.take(0).context("Failed to deserialise group records")?;

    for group in &affected {
        let new_ids: Vec<String> = group
            .container_ids
            .iter()
            .filter(|id| id.as_str() != container_id)
            .cloned()
            .collect();
        let updated = CustomGroup {
            group_id: group.group_id.clone(),
            name: group.name.clone(),
            colour: group.colour.clone(),
            container_ids: new_ids,
        };
        let _: Option<CustomGroup> = db
            .upsert(("container_groups", group.group_id.as_str()))
            .content(updated)
            .await
            .with_context(|| {
                format!(
                    "DB upsert failed unassigning container from group {}",
                    group.group_id
                )
            })?;
    }
    Ok(())
}

/// Save (or replace) the ordering for a group.
pub async fn set_order(
    db: &Surreal<Db>,
    order_key: &str,
    container_ids: Vec<String>,
) -> anyhow::Result<GroupOrder> {
    let order = GroupOrder {
        order_key: order_key.to_string(),
        container_ids,
    };
    let _: Option<GroupOrder> = db
        .upsert(("container_group_order", order_key))
        .content(order.clone())
        .await
        .with_context(|| format!("DB upsert failed for container_group_order:{order_key}"))?;
    Ok(order)
}

/// Fetch the stored ordering for a group. Returns `None` if no ordering has been saved.
pub async fn get_order(db: &Surreal<Db>, order_key: &str) -> anyhow::Result<Option<GroupOrder>> {
    let record: Option<OrderRecord> = db
        .select(("container_group_order", order_key))
        .await
        .with_context(|| format!("DB select failed for container_group_order:{order_key}"))?;
    Ok(record.map(GroupOrder::from))
}

/// Fetch the stored display order of groups in the UI (group IDs in display sequence).
pub async fn get_group_display_order(db: &Surreal<Db>) -> anyhow::Result<Vec<String>> {
    Ok(get_order(db, "__display__")
        .await?
        .map(|o| o.container_ids)
        .unwrap_or_default())
}

/// Save (or replace) the display order of groups in the UI.
pub async fn set_group_display_order(db: &Surreal<Db>, group_ids: Vec<String>) -> anyhow::Result<()> {
    set_order(db, "__display__", group_ids).await?;
    Ok(())
}
