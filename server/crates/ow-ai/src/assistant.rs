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

/// A reply and the session the assistant wants the browser to keep for the next request. The session is an opaque string:
/// the browser stores it (per browser) and sends it back with each request; the server keeps none.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    pub reply: Reply,
    /// A new or changed session to hand back to the browser; `None` leaves the one it has.
    pub session: Option<String>,
}

impl From<Reply> for Answer {
    fn from(reply: Reply) -> Self {
        Self {
            reply,
            session: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiError {
    /// The assistant cannot be reached or is not set up. The detail is for the log only.
    Unavailable(String),
    /// The assistant answered with something that is not a reply. The detail is for the log only.
    Failed(String),
}

/// What a streaming assistant yields, in order: `Started` once when it has taken the message, `Delta` for each piece of
/// text, then `Done` (the route sends the full text with it). `Session` may come at any point before `Done`: the session to
/// hand back to the browser. An `Err` ends the reply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiEvent {
    Started,
    Delta(String),
    Session(String),
    Done,
}

/// Given a room, its messages (the newest last) and the session the browser sent with the request (if any), returns the reply.
///
/// `reply` is required. `stream` has a default made from it (`Started`, one `Delta` with the whole text, `Done`); an
/// assistant that really streams overrides `stream` and writes `reply` as `Box::pin(collect(self.stream(room_id, messages, session)))`.
pub trait Assistant: Send + Sync {
    fn reply<'a>(
        &'a self,
        room_id: &'a str,
        messages: &'a [AiMessage],
        session: Option<&'a str>,
    ) -> BoxFuture<'a, Result<Answer, AiError>>;

    fn stream<'a>(
        &'a self,
        room_id: &'a str,
        messages: &'a [AiMessage],
        session: Option<&'a str>,
    ) -> BoxStream<'a, Result<AiEvent, AiError>> {
        let answer = stream::once(self.reply(room_id, messages, session)).flat_map(|result| {
            stream::iter(match result {
                Ok(Answer { reply, session }) => {
                    let mut events: Vec<Result<AiEvent, AiError>> = session
                        .into_iter()
                        .map(|s| Ok(AiEvent::Session(s)))
                        .collect();
                    if let Reply::Text(text) = reply {
                        events.push(Ok(AiEvent::Delta(text)));
                    }
                    events.push(Ok(AiEvent::Done));
                    events
                }
                Err(error) => vec![Err(error)],
            })
        });
        Box::pin(stream::once(async { Ok(AiEvent::Started) }).chain(answer))
    }
}

/// The answer a stream adds up to: its text (or nothing when it said none) and the last session it gave.
pub async fn collect(
    mut events: BoxStream<'_, Result<AiEvent, AiError>>,
) -> Result<Answer, AiError> {
    let mut text = String::new();
    let mut session = None;
    while let Some(event) = events.next().await {
        match event? {
            AiEvent::Delta(piece) => text.push_str(&piece),
            AiEvent::Session(value) => session = Some(value),
            AiEvent::Started => {}
            AiEvent::Done => break,
        }
    }
    let reply = if text.is_empty() {
        Reply::Nothing
    } else {
        Reply::Text(text)
    };
    Ok(Answer { reply, session })
}
