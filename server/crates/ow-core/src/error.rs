use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("{0}")]
    Invalid(String),
    #[error("storage failed: {0}")]
    Storage(String),
}
