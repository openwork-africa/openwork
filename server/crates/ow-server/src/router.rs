use std::path::PathBuf;
use std::sync::Arc;

use axum::http::{header, HeaderValue, Method};
use axum::middleware;
use axum::routing::{get, post, put};
use axum::Router;
use ow_ai::Assistant;
use ow_core::{ChangeRepository, FileStore};
use tower_http::cors::CorsLayer;

use crate::error::ApiError;
use crate::session::Sessions;
use crate::{files, logging, session, static_files, sync};

pub struct AppState<R, F> {
    pub assistant: Option<Arc<dyn Assistant>>,
    pub changes: R,
    pub files: F,
    pub sessions: Option<Sessions>,
    pub static_dir: PathBuf,
    pub dev_origins: Vec<HeaderValue>,
}

async fn healthz() -> &'static str {
    "ok"
}

async fn unknown_api() -> ApiError {
    ApiError::not_found()
}

pub fn build<R: ChangeRepository, F: FileStore>(state: AppState<R, F>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(state.dev_origins.clone())
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE])
        .allow_credentials(true);
    let assistant = state.assistant.clone();
    Router::new()
        .route("/healthz", get(healthz))
        .merge(ow_ai::router(assistant))
        .merge(session::routes::<R, F>())
        .route("/api/push", post(sync::push::<R, F>))
        .route("/api/pull", get(sync::pull::<R, F>))
        .route(
            "/api/files/{id}",
            put(files::put::<R, F>).get(files::get::<R, F>),
        )
        .route("/api", get(unknown_api))
        .route("/api/", get(unknown_api))
        .route("/api/{*rest}", axum::routing::any(unknown_api))
        .fallback(get(static_files::serve::<R, F>))
        .layer(cors)
        .layer(middleware::from_fn(logging::log_request))
        .with_state(Arc::new(state))
}
