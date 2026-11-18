use std::future::Future;
use std::pin::Pin;

use serde::{Deserialize, Serialize};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// One message of a room, as the browser sends it. Nothing about the person or the device.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub id: String,
    pub author_id: String,
    pub content: String,
    pub created_at: i64,
}

/// What an assistant says back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Reply {
    /// The words to save in the room as a message from the assistant.
    Text(String),
    /// The assistant chose to say nothing.
    Nothing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiError {
    /// The assistant cannot be reached or is not set up. The detail is for the log only.
    Unavailable(String),
    /// The assistant answered with something that is not a reply. The detail is for the log only.
    Failed(String),
}

/// Given a room and its messages (the newest last), returns the reply.
pub trait Assistant: Send + Sync {
    fn reply<'a>(
        &'a self,
        room_id: &'a str,
        messages: &'a [AiMessage],
    ) -> BoxFuture<'a, Result<Reply, AiError>>;
}
