use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Path, Request, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use ow_core::{ChangeRepository, CoreError, FileStore};

use crate::copy;
use crate::error::ApiError;
use crate::router::AppState;
use crate::session::Caller;

pub const FILE_LIMIT: usize = 25 * 1024 * 1024;

fn too_large() -> ApiError {
    ApiError::new(StatusCode::PAYLOAD_TOO_LARGE, copy::FILE_TOO_LARGE)
}

pub async fn put<R: ChangeRepository, F: FileStore>(
    State(state): State<Arc<AppState<R, F>>>,
    caller: Caller,
    Path(id): Path<String>,
    request: Request,
) -> Result<StatusCode, ApiError> {
    let content_type = request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let declared = request
        .headers()
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<usize>().ok());
    if declared.is_some_and(|length| length > FILE_LIMIT) {
        return Err(too_large());
    }
    let bytes = axum::body::to_bytes(request.into_body(), FILE_LIMIT)
        .await
        .map_err(|_| too_large())?;
    state
        .files
        .put(&id, &content_type, bytes.to_vec(), caller.owner())
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get<R: ChangeRepository, F: FileStore>(
    State(state): State<Arc<AppState<R, F>>>,
    caller: Caller,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    match state.files.get(&id, caller.owner()).await {
        Ok(Some(file)) => {
            let mut headers = HeaderMap::new();
            if let Ok(value) = file.content_type.parse() {
                headers.insert(header::CONTENT_TYPE, value);
            }
            Ok((headers, Body::from(file.bytes)).into_response())
        }
        Ok(None) | Err(CoreError::Invalid(_)) => {
            Err(ApiError::new(StatusCode::NOT_FOUND, copy::FILE_MISSING))
        }
        Err(error) => Err(error.into()),
    }
}
