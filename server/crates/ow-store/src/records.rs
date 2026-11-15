use ow_core::{Applied, Change, ChangeRepository, CoreError, Entity, Kind, PullAnswer};
use sqlx::{Row, SqlitePool};

use crate::storage;

pub struct SqliteChangeRepository {
    pool: SqlitePool,
}

impl SqliteChangeRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl ChangeRepository for SqliteChangeRepository {
    async fn apply(&self, change: Change) -> Result<Applied, CoreError> {
        let mut tx = self.pool.begin().await.map_err(storage)?;
        let existing: Option<i64> =
            sqlx::query_scalar("SELECT updated_at FROM records WHERE kind = ? AND id = ?")
                .bind(change.kind.as_str())
                .bind(&change.id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(storage)?;
        if existing.is_some_and(|stored| stored >= change.updated_at) {
            return Ok(Applied::Ignored);
        }
        let seq: i64 = sqlx::query_scalar(
            "UPDATE sequence SET value = value + 1 WHERE id = 1 RETURNING value",
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
        let data = serde_json::to_string(&change.data).map_err(storage)?;
        sqlx::query(
            "INSERT INTO records (kind, id, seq, updated_at, data) VALUES (?, ?, ?, ?, ?) \
             ON CONFLICT (kind, id) DO UPDATE SET \
             seq = excluded.seq, updated_at = excluded.updated_at, data = excluded.data",
        )
        .bind(change.kind.as_str())
        .bind(&change.id)
        .bind(seq)
        .bind(change.updated_at)
        .bind(data)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        tx.commit().await.map_err(storage)?;
        Ok(Applied::Stored)
    }

    async fn pull(&self, since: u64) -> Result<PullAnswer, CoreError> {
        let since = i64::try_from(since).unwrap_or(i64::MAX);
        let rows = sqlx::query(
            "SELECT kind, id, seq, updated_at, data FROM records WHERE seq > ? ORDER BY seq",
        )
        .bind(since)
        .fetch_all(&self.pool)
        .await
        .map_err(storage)?;
        let mut cursor = since;
        let mut changes = Vec::with_capacity(rows.len());
        for row in rows {
            let kind = Kind::parse(row.get::<&str, _>("kind"))
                .ok_or_else(|| storage("unknown record kind"))?;
            let value = serde_json::from_str(row.get::<&str, _>("data")).map_err(storage)?;
            changes.push(Change {
                kind,
                id: row.get("id"),
                updated_at: row.get("updated_at"),
                data: Entity::from_value(kind, value).map_err(storage)?,
            });
            cursor = row.get("seq");
        }
        Ok(PullAnswer {
            changes,
            cursor: u64::try_from(cursor).unwrap_or_default(),
        })
    }
}
