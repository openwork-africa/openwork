use std::sync::Arc;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use ow_ai::{AiError, AiMessage, Assistant, BoxFuture, Reply};
use ow_server::compose::build_app_with;
use ow_server::config::Config;
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

struct Fake(Result<Reply, AiError>);

impl Assistant for Fake {
    fn reply<'a>(
        &'a self,
        _: &'a str,
        messages: &'a [AiMessage],
    ) -> BoxFuture<'a, Result<Reply, AiError>> {
        let answer = match &self.0 {
            Ok(Reply::Text(_)) => Ok(Reply::Text(format!("{} messages", messages.len()))),
            other => other.clone(),
        };
        Box::pin(async move { answer })
    }
}

fn config(data: &TempDir) -> Config {
    Config {
        host: "127.0.0.1".into(),
        port: 0,
        data_dir: data.path().join("nested"),
        static_dir: data.path().join("static"),
        dev_origins: vec![],
    }
}

async fn app(assistant: Option<Result<Reply, AiError>>) -> (Router, TempDir) {
    let data = tempfile::tempdir().unwrap();
    let assistant = assistant.map(|answer| Arc::new(Fake(answer)) as Arc<dyn Assistant>);
    (
        build_app_with(&config(&data), assistant).await.unwrap(),
        data,
    )
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

fn reply_request(body: Value) -> Request<Body> {
    Request::post("/api/ai/reply")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn one_message() -> Value {
    json!({ "roomId": "r1", "messages": [{ "id": "m1", "authorId": "you", "content": "hi", "createdAt": 1 }] })
}

#[tokio::test]
async fn a_plugin_replies_with_the_text() {
    let (app, _data) = app(Some(Ok(Reply::Text(String::new())))).await;
    let (status, body) = call(&app, reply_request(one_message())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "status": "reply", "text": "1 messages" }));
}

#[tokio::test]
async fn a_silent_plugin_says_none() {
    let (app, _data) = app(Some(Ok(Reply::Nothing))).await;
    let (status, body) = call(&app, reply_request(one_message())).await;
    assert_eq!(
        (status, body),
        (StatusCode::OK, json!({ "status": "none" }))
    );
}

#[tokio::test]
async fn with_no_plugin_reply_is_404_and_status_says_not_configured() {
    let (app, _data) = app(None).await;
    let (status, body) = call(&app, reply_request(one_message())).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(body["message"].is_string());
    let (status, body) = call(
        &app,
        Request::get("/api/ai/status").body(Body::empty()).unwrap(),
    )
    .await;
    assert_eq!(
        (status, body),
        (
            StatusCode::OK,
            json!({ "configured": false, "pending": [] })
        )
    );
}

#[tokio::test]
async fn a_plugin_error_is_a_friendly_message_without_internals() {
    let secret = "connect to http://internal.example:9/chat refused, key=abc123";
    for (error, expected) in [
        (AiError::Failed(secret.into()), StatusCode::BAD_GATEWAY),
        (
            AiError::Unavailable(secret.into()),
            StatusCode::SERVICE_UNAVAILABLE,
        ),
    ] {
        let (app, _data) = app(Some(Err(error))).await;
        let (status, body) = call(&app, reply_request(one_message())).await;
        assert_eq!(status, expected);
        let message = body["message"].as_str().unwrap();
        assert!(
            !message.contains("internal")
                && !message.contains("abc123")
                && !message.contains("http"),
            "{message}"
        );
    }
}

#[tokio::test]
async fn bad_bodies_are_400_and_the_status_reports_configured() {
    let (app, _data) = app(Some(Ok(Reply::Nothing))).await;
    let (status, _) = call(
        &app,
        reply_request(json!({ "roomId": "r1", "messages": [] })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = call(&app, reply_request(json!({ "nope": 1 }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (_, body) = call(
        &app,
        Request::get("/api/ai/status").body(Body::empty()).unwrap(),
    )
    .await;
    assert_eq!(body, json!({ "configured": true, "pending": [] }));
}

#[tokio::test]
async fn a_second_reply_for_a_room_already_replying_is_refused_and_status_lists_it() {
    struct Slow(tokio::sync::Notify);
    impl Assistant for Slow {
        fn reply<'a>(
            &'a self,
            _: &'a str,
            _: &'a [AiMessage],
        ) -> BoxFuture<'a, Result<Reply, AiError>> {
            Box::pin(async move {
                self.0.notified().await;
                Ok(Reply::Text("done".into()))
            })
        }
    }
    let data = tempfile::tempdir().unwrap();
    let slow = Arc::new(Slow(tokio::sync::Notify::new()));
    let app = build_app_with(&config(&data), Some(slow.clone()))
        .await
        .unwrap();
    let first = tokio::spawn({
        let app = app.clone();
        async move { call(&app, reply_request(one_message())).await }
    });
    let status_request = || Request::get("/api/ai/status").body(Body::empty()).unwrap();
    let mut listed = Value::Null;
    for _ in 0..100 {
        listed = call(&app, status_request()).await.1;
        if listed["pending"] == json!(["r1"]) {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    assert_eq!(listed, json!({ "configured": true, "pending": ["r1"] }));
    let (status, _) = call(&app, reply_request(one_message())).await;
    assert_eq!(status, StatusCode::CONFLICT);
    slow.0.notify_one();
    assert_eq!(first.await.unwrap().0, StatusCode::OK);
    assert_eq!(call(&app, status_request()).await.1["pending"], json!([]));
}
