use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::{rejection::JsonRejection, DefaultBodyLimit, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::assistant::{AiError, AiMessage, Assistant, Reply};
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

async fn reply(
    State(state): State<Arc<AiState>>,
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
    let _pending = PendingRoom {
        state: state.clone(),
        room_id: body.room_id.clone(),
    };
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
