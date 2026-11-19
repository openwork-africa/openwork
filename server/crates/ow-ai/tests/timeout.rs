use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use ow_ai::{router_with_timeout, AiError, AiMessage, Answer, Assistant, BoxFuture};
use serde_json::{json, Value};
use tower::ServiceExt;

struct Never;

impl Assistant for Never {
    fn reply<'a>(
        &'a self,
        _: &'a str,
        _: &'a [AiMessage],
        _: Option<&'a str>,
    ) -> BoxFuture<'a, Result<Answer, AiError>> {
        Box::pin(std::future::pending())
    }
}

async fn call(app: &Router, request: Request<Body>) -> (StatusCode, Value) {
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn an_assistant_that_never_answers_times_out_with_503_and_the_room_is_no_longer_pending() {
    let app: Router = router_with_timeout(Some(Arc::new(Never)), Duration::from_millis(50));
    let body = json!({ "roomId": "r1", "messages": [{ "id": "m", "authorId": "you", "content": "hi", "createdAt": 1 }] });
    let request = Request::post("/api/ai/reply")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let (status, body) = call(&app, request).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body["message"].is_string());
    let (_, status) = call(
        &app,
        Request::get("/api/ai/status").body(Body::empty()).unwrap(),
    )
    .await;
    assert_eq!(status, json!({ "configured": true, "pending": [] }));
}
