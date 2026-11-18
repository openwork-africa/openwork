use std::future::Future;
use std::pin::Pin;

use futures_util::stream::{self, Stream, StreamExt};
use serde::{Deserialize, Serialize};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
pub type BoxStream<'a, T> = Pin<Box<dyn Stream<Item = T> + Send + 'a>>;

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

/// What a streaming assistant yields, in order: `Started` once when it has taken the message, `Delta` for each piece of
/// text, then `Done` (the route sends the full text with it). An `Err` ends the reply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiEvent {
    Started,
    Delta(String),
    Done,
}

/// Given a room and its messages (the newest last), returns the reply.
///
/// Implement `stream` (the route asks for it when the browser wants a stream) or `reply`. Each has a default made
/// from the other, so an assistant that implements one serves both kinds of request; implementing neither never answers.
pub trait Assistant: Send + Sync {
    fn reply<'a>(
        &'a self,
        room_id: &'a str,
        messages: &'a [AiMessage],
    ) -> BoxFuture<'a, Result<Reply, AiError>> {
        Box::pin(collect(self.stream(room_id, messages)))
    }

    fn stream<'a>(
        &'a self,
        room_id: &'a str,
        messages: &'a [AiMessage],
    ) -> BoxStream<'a, Result<AiEvent, AiError>> {
        let answer = stream::once(self.reply(room_id, messages)).flat_map(|result| {
            stream::iter(match result {
                Ok(Reply::Text(text)) => vec![Ok(AiEvent::Delta(text)), Ok(AiEvent::Done)],
                Ok(Reply::Nothing) => vec![Ok(AiEvent::Done)],
                Err(error) => vec![Err(error)],
            })
        });
        Box::pin(stream::once(async { Ok(AiEvent::Started) }).chain(answer))
    }
}

/// The reply a stream adds up to: its text, or nothing when it said none.
pub async fn collect(
    mut events: BoxStream<'_, Result<AiEvent, AiError>>,
) -> Result<Reply, AiError> {
    let mut text = String::new();
    while let Some(event) = events.next().await {
        match event? {
            AiEvent::Delta(piece) => text.push_str(&piece),
            AiEvent::Started => {}
            AiEvent::Done => break,
        }
    }
    Ok(if text.is_empty() {
        Reply::Nothing
    } else {
        Reply::Text(text)
    })
}
