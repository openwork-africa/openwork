use std::future::Future;

use crate::entity::{Change, PullAnswer};
use crate::error::CoreError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Applied {
    Stored,
    Ignored,
    /// The record id already belongs to another owner, so nothing was written.
    Foreign,
}

/// The owner of data saved without signing in: one shared pool, kept apart from every account.
pub const GUEST_OWNER: &str = "";

pub trait ChangeRepository: Send + Sync + 'static {
    /// Store a change for `owner`; an id another owner already holds is `Applied::Foreign`.
    fn apply(
        &self,
        change: Change,
        owner: &str,
    ) -> impl Future<Output = Result<Applied, CoreError>> + Send;
    /// The changes after `since` that belong to `owner`.
    fn pull(
        &self,
        since: u64,
        owner: &str,
    ) -> impl Future<Output = Result<PullAnswer, CoreError>> + Send;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredFile {
    pub content_type: String,
    pub bytes: Vec<u8>,
}

pub trait FileStore: Send + Sync + 'static {
    fn put(
        &self,
        id: &str,
        content_type: &str,
        bytes: Vec<u8>,
        owner: &str,
    ) -> impl Future<Output = Result<(), CoreError>> + Send;
    /// The file, only when `owner` owns it.
    fn get(
        &self,
        id: &str,
        owner: &str,
    ) -> impl Future<Output = Result<Option<StoredFile>, CoreError>> + Send;
}

pub fn valid_file_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}
