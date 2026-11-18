use std::collections::BTreeSet;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::{rejection::JsonRejection, DefaultBodyLimit, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use futures_util::stream;
use futures_util::StreamExt;
use tokio::sync::mpsc;
use tokio::time::Instant;

use crate::assistant::{AiError, AiEvent, AiMessage, Assistant, Reply};
use crate::copy;

pub const MAX_BODY_BYTES: usize = 1024 * 1024;
pub const MAX_ROOM_ID_BYTES: usize = 128;
pub const MAX_MESSAGES: usize = 200;
pub const MAX_CONTENT_BYTES: usize = 16 * 1024;
/// How long the assistant has to answer before the request gives up.
pub const REPLY_TIMEOUT: Duration = Duration::from_secs(150);

struct AiState {
    timeout: Duration,
    assistant: Option<Arc<dyn Assistant>>,
    pending: Mutex<BTreeSet<String>>,
}

/// Removes the room from the pending set when the reply ends, however it ends.
struct PendingRoom {
    state: Arc<AiState>,
    room_id: String,
}

impl Drop for PendingRoom {
    fn drop(&mut self) {
        if let Ok(mut pending) = self.state.pending.lock() {
            pending.remove(&self.room_id);
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReplyBody {
    room_id: String,
    messages: Vec<AiMessage>,
}

fn refusal(status: StatusCode, message: &str) -> Response {
    (status, Json(json!({ "message": message }))).into_response()
}

/// `POST /api/ai/reply` and `GET /api/ai/status`. With no assistant the first answers 404 and the second says
/// the AI is not configured.
pub fn router<S: Clone + Send + Sync + 'static>(
    assistant: Option<Arc<dyn Assistant>>,
) -> Router<S> {
    router_with_timeout(assistant, REPLY_TIMEOUT)
}

/// `router` with the time the assistant has to answer given, for tests.
pub fn router_with_timeout<S: Clone + Send + Sync + 'static>(
    assistant: Option<Arc<dyn Assistant>>,
    timeout: Duration,
) -> Router<S> {
    let state = Arc::new(AiState {
        timeout,
        assistant,
        pending: Mutex::new(BTreeSet::new()),
    });
    Router::new()
        .route(
            "/api/ai/reply",
            post(reply).layer(DefaultBodyLimit::max(MAX_BODY_BYTES)),
        )
        .route("/api/ai/status", get(status))
        .with_state(state)
}

fn invalid(body: &ReplyBody) -> Option<&'static str> {
    if body.room_id.is_empty() || body.messages.is_empty() {
        return Some(copy::NO_MESSAGES);
    }
    if body.room_id.len() > MAX_ROOM_ID_BYTES {
        return Some(copy::ROOM_ID_TOO_LONG);
    }
    if body.messages.len() > MAX_MESSAGES {
        return Some(copy::TOO_MANY_MESSAGES);
    }
    let empty = |message: &AiMessage| {
        message.id.is_empty() || message.author_id.is_empty() || message.content.is_empty()
    };
    if body.messages.iter().any(empty) {
        return Some(copy::EMPTY_FIELD);
    }
    if body
        .messages
        .iter()
        .any(|message| message.content.len() > MAX_CONTENT_BYTES)
    {
        return Some(copy::MESSAGE_TOO_LONG);
    }
    None
}

async fn status(State(state): State<Arc<AiState>>) -> Json<Value> {
    let pending: Vec<String> = state
        .pending
        .lock()
        .map(|rooms| rooms.iter().cloned().collect())
        .unwrap_or_default();
    Json(json!({ "configured": state.assistant.is_some(), "pending": pending }))
}

fn wants_stream(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.contains("text/event-stream"))
}

fn sse(name: &str, data: Value) -> Result<Event, Infallible> {
    Ok(Event::default()
        .event(name)
        .json_data(data)
        .unwrap_or_else(|_| Event::default().event(name)))
}

fn failure_copy(error: &AiError) -> &'static str {
    match error {
        AiError::Unavailable(detail) => {
            tracing::warn!("assistant unavailable: {detail}");
            copy::UNAVAILABLE
        }
        AiError::Failed(detail) => {
            tracing::error!("assistant failed: {detail}");
            copy::FAILED
        }
    }
}

type Events = mpsc::Sender<Result<Event, Infallible>>;

async fn emit(events: &Events, name: &str, data: Value) -> bool {
    events.send(sse(name, data)).await.is_ok()
}

/// Feeds the assistant's events to the open stream until it ends, fails, times out or the browser leaves. The room's
/// claim is held by this task, so it clears however the stream ends.
async fn pump(
    assistant: Arc<dyn Assistant>,
    body: ReplyBody,
    timeout: Duration,
    events: Events,
    _held: PendingRoom,
) {
    let deadline = Instant::now() + timeout;
    let mut incoming = assistant.stream(&body.room_id, &body.messages);
    let mut text = String::new();
    let mut started = false;
    loop {
        let next = tokio::select! {
            _ = events.closed() => return,
            next = tokio::time::timeout_at(deadline, incoming.next()) => next,
        };
        let sent = match next {
            Err(_) => {
                tracing::warn!("assistant timed out");
                emit(&events, "error", json!({ "message": copy::TIMED_OUT })).await;
                return;
            }
            Ok(Some(Err(error))) => {
                emit(&events, "error", json!({ "message": failure_copy(&error) })).await;
                return;
            }
            Ok(Some(Ok(AiEvent::Started))) if started => true,
            Ok(Some(Ok(AiEvent::Started))) => {
                started = true;
                emit(&events, "started", json!({})).await
            }
            Ok(Some(Ok(AiEvent::Delta(piece)))) => {
                let opened = started || emit(&events, "started", json!({})).await;
                started = true;
                text.push_str(&piece);
                opened && emit(&events, "delta", json!({ "text": piece })).await
            }
            Ok(Some(Ok(AiEvent::Done))) | Ok(None) => {
                if !started {
                    emit(&events, "started", json!({})).await;
                }
                emit(&events, "done", json!({ "text": text })).await;
                return;
            }
        };
        if !sent {
            return;
        }
    }
}

/// The reply as server-sent events: `started` first, `delta` ({text}) as the text comes, then `done` ({text}, all of it)
/// or `error` ({message}). The room is pending only while the stream is open; when the browser leaves, the work stops.
fn streamed(
    state: &AiState,
    assistant: Arc<dyn Assistant>,
    body: ReplyBody,
    held: PendingRoom,
) -> Response {
    let (events, receiving) = mpsc::channel(16);
    tokio::spawn(pump(assistant, body, state.timeout, events, held));
    let events = stream::unfold(receiving, |mut receiving| async {
        receiving.recv().await.map(|event| (event, receiving))
    });
    Sse::new(events)
        .keep_alive(KeepAlive::default())
        .into_response()
}

async fn reply(
    State(state): State<Arc<AiState>>,
    headers: HeaderMap,
    body: Result<Json<ReplyBody>, JsonRejection>,
) -> Response {
    let Some(assistant) = state.assistant.clone() else {
        return refusal(StatusCode::NOT_FOUND, copy::NOT_FOUND);
    };
    let body = match body {
        Ok(Json(body)) => body,
        Err(rejection) if rejection.status() == StatusCode::PAYLOAD_TOO_LARGE => {
            return refusal(StatusCode::PAYLOAD_TOO_LARGE, copy::BODY_TOO_LARGE)
        }
        Err(_) => return refusal(StatusCode::BAD_REQUEST, copy::BAD_BODY),
    };
    if let Some(problem) = invalid(&body) {
        return refusal(StatusCode::BAD_REQUEST, problem);
    }
    let inserted = state
        .pending
        .lock()
        .map(|mut rooms| rooms.insert(body.room_id.clone()))
        .unwrap_or(false);
    if !inserted {
        return refusal(StatusCode::CONFLICT, copy::BUSY);
    }
    let pending = PendingRoom {
        state: state.clone(),
        room_id: body.room_id.clone(),
    };
    if wants_stream(&headers) {
        return streamed(&state, assistant, body, pending);
    }
    let answer = tokio::time::timeout(
        state.timeout,
        assistant.reply(&body.room_id, &body.messages),
    )
    .await;
    let Ok(answer) = answer else {
        tracing::warn!("assistant timed out after {}s", state.timeout.as_secs());
        return refusal(StatusCode::SERVICE_UNAVAILABLE, copy::TIMED_OUT);
    };
    match answer {
        Ok(Reply::Text(text)) => Json(json!({ "status": "reply", "text": text })).into_response(),
        Ok(Reply::Nothing) => Json(json!({ "status": "none" })).into_response(),
        Err(AiError::Unavailable(detail)) => {
            tracing::warn!("assistant unavailable: {detail}");
            refusal(StatusCode::SERVICE_UNAVAILABLE, copy::UNAVAILABLE)
        }
        Err(AiError::Failed(detail)) => {
            tracing::error!("assistant failed: {detail}");
            refusal(StatusCode::BAD_GATEWAY, copy::FAILED)
        }
    }
}
