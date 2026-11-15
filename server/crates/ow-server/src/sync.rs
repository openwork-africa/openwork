use std::sync::Arc;

use axum::extract::{Query, Request, State};
use axum::http::StatusCode;
use axum::Json;
use ow_core::{sync, ChangeRepository, FileStore, PullAnswer, PushAnswers};
use serde::Deserialize;
use serde_json::Value;

use crate::error::ApiError;
use crate::router::AppState;

pub const PUSH_LIMIT: usize = 16 * 1024 * 1024;

#[derive(Deserialize)]
struct RawPush {
    changes: Vec<Value>,
}

#[derive(Deserialize)]
pub struct PullQuery {
    since: Option<String>,
}

pub async fn push<R: ChangeRepository, F: FileStore>(
    State(state): State<Arc<AppState<R, F>>>,
    request: Request,
) -> Result<Json<PushAnswers>, ApiError> {
    let bytes = axum::body::to_bytes(request.into_body(), PUSH_LIMIT)
        .await
        .map_err(|_| {
            ApiError::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                "This push is too large. Send fewer changes at once.",
            )
        })?;
    let body: RawPush = serde_json::from_slice(&bytes).map_err(|_| {
        ApiError::new(
            StatusCode::BAD_REQUEST,
            "The push body must be JSON like {\"changes\": [...]}.",
        )
    })?;
    let answers = sync::push(&state.changes, body.changes).await;
    Ok(Json(PushAnswers { answers }))
}

pub async fn pull<R: ChangeRepository, F: FileStore>(
    State(state): State<Arc<AppState<R, F>>>,
    Query(query): Query<PullQuery>,
) -> Result<Json<PullAnswer>, ApiError> {
    let since = match query.since.as_deref() {
        None | Some("") => 0,
        Some(text) => text.parse::<u64>().map_err(|_| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "The since value must be a whole number.",
            )
        })?,
    };
    Ok(Json(state.changes.pull(since).await?))
}
