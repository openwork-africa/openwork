use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use ow_core::{ChangeRepository, FileStore};
use tower::ServiceExt;
use tower_http::services::{ServeDir, ServeFile};

use crate::router::AppState;

pub async fn serve<R: ChangeRepository, F: FileStore>(
    State(state): State<Arc<AppState<R, F>>>,
    request: Request,
) -> Response {
    let index = state.static_dir.join("index.html");
    if !index.is_file() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "The app is not built yet. Build the frontend, then start the server with --static pointing at its dist folder.",
        )
            .into_response();
    }
    let service = ServeDir::new(&state.static_dir).fallback(ServeFile::new(index));
    match service.oneshot(request).await {
        Ok(response) => response.into_response(),
        Err(never) => match never {},
    }
}
