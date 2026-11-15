use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use ow_core::CoreError;
use serde_json::json;

pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "There is nothing at this address.")
    }
}

impl From<CoreError> for ApiError {
    fn from(error: CoreError) -> Self {
        match error {
            CoreError::Invalid(message) => Self::new(StatusCode::BAD_REQUEST, message),
            CoreError::Storage(detail) => {
                tracing::error!("storage failed: {detail}");
                Self::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "The server could not read or save data. Try again.",
                )
            }
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "message": self.message }))).into_response()
    }
}
