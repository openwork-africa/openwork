use std::path::PathBuf;

use ow_core::{valid_file_id, CoreError, FileStore, StoredFile};
use sqlx::SqlitePool;

use crate::{copy, storage};

pub struct DiskFileStore {
    pool: SqlitePool,
    dir: PathBuf,
}

impl DiskFileStore {
    pub(crate) fn new(pool: SqlitePool, dir: PathBuf) -> Self {
        Self { pool, dir }
    }

    fn checked_path(&self, id: &str) -> Result<PathBuf, CoreError> {
        if valid_file_id(id) {
            Ok(self.dir.join(id))
        } else {
            Err(CoreError::Invalid(copy::INVALID_FILE_ID.into()))
        }
    }
}

impl FileStore for DiskFileStore {
    async fn put(&self, id: &str, content_type: &str, bytes: Vec<u8>) -> Result<(), CoreError> {
        let path = self.checked_path(id)?;
        let temporary = self.dir.join(format!("{id}.partial"));
        tokio::fs::write(&temporary, bytes).await.map_err(storage)?;
        tokio::fs::rename(&temporary, &path)
            .await
            .map_err(storage)?;
        sqlx::query(
            "INSERT INTO file_types (id, content_type) VALUES (?, ?) \
             ON CONFLICT (id) DO UPDATE SET content_type = excluded.content_type",
        )
        .bind(id)
        .bind(content_type)
        .execute(&self.pool)
        .await
        .map_err(storage)?;
        Ok(())
    }

    async fn get(&self, id: &str) -> Result<Option<StoredFile>, CoreError> {
        let path = self.checked_path(id)?;
        let content_type: Option<String> =
            sqlx::query_scalar("SELECT content_type FROM file_types WHERE id = ?")
                .bind(id)
                .fetch_optional(&self.pool)
                .await
                .map_err(storage)?;
        let Some(content_type) = content_type else {
            return Ok(None);
        };
        match tokio::fs::read(&path).await {
            Ok(bytes) => Ok(Some(StoredFile {
                content_type,
                bytes,
            })),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(storage(error)),
        }
    }
}
