use std::future::Future;

use crate::entity::{Change, PullAnswer};
use crate::error::CoreError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Applied {
    Stored,
    Ignored,
}

pub trait ChangeRepository: Send + Sync + 'static {
    fn apply(&self, change: Change) -> impl Future<Output = Result<Applied, CoreError>> + Send;
    fn pull(&self, since: u64) -> impl Future<Output = Result<PullAnswer, CoreError>> + Send;
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
    ) -> impl Future<Output = Result<(), CoreError>> + Send;
    fn get(&self, id: &str) -> impl Future<Output = Result<Option<StoredFile>, CoreError>> + Send;
}
