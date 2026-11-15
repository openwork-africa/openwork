use std::time::Instant;

use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;

pub async fn log_request(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let started = Instant::now();
    let response = next.run(request).await;
    tracing::info!(
        "{method} {path} {} {}ms",
        response.status().as_u16(),
        started.elapsed().as_millis()
    );
    response
}
