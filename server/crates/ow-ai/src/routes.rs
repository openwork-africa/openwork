use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use axum::extract::{rejection::JsonRejection, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::assistant::{AiError, AiMessage, Assistant, Reply};
use crate::copy;

struct AiState {
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
    let state = Arc::new(AiState {
        assistant,
        pending: Mutex::new(BTreeSet::new()),
    });
    Router::new()
        .route("/api/ai/reply", post(reply))
        .route("/api/ai/status", get(status))
        .with_state(state)
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
    let Ok(Json(body)) = body else {
        return refusal(StatusCode::BAD_REQUEST, copy::BAD_BODY);
    };
    if body.room_id.is_empty() || body.messages.is_empty() {
        return refusal(StatusCode::BAD_REQUEST, copy::NO_MESSAGES);
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
    match assistant.reply(&body.room_id, &body.messages).await {
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
