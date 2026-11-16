mod copy;
mod files;
mod records;

use std::path::Path;
use std::str::FromStr;

use ow_core::CoreError;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

pub use files::DiskFileStore;
pub use records::SqliteChangeRepository;

pub struct Store {
    pub changes: SqliteChangeRepository,
    pub files: DiskFileStore,
}

pub(crate) fn storage(error: impl std::fmt::Display) -> CoreError {
    CoreError::Storage(error.to_string())
}

pub async fn open(data_dir: &Path) -> Result<Store, CoreError> {
    let files_dir = data_dir.join("files");
    tokio::fs::create_dir_all(&files_dir)
        .await
        .map_err(storage)?;
    let options = SqliteConnectOptions::from_str("sqlite://")
        .map_err(storage)?
        .filename(data_dir.join("openwork.db"))
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);
    let pool: SqlitePool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(storage)?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(storage)?;
    Ok(Store {
        changes: SqliteChangeRepository::new(pool.clone()),
        files: DiskFileStore::new(pool, files_dir),
    })
}
