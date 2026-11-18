use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::response::Response;
use axum::Router;
use futures_util::stream;
use ow_ai::{AiError, AiEvent, AiMessage, Assistant, BoxStream};
use ow_server::compose::build_app_with;
use ow_server::config::Config;
use serde_json::{json, Value};
use tokio::sync::{mpsc, Mutex};
use tower::ServiceExt;

/// Streams what a test sends it, so a test decides when the reply moves.
struct Scripted(Mutex<Option<mpsc::UnboundedReceiver<Result<AiEvent, AiError>>>>);

impl Assistant for Scripted {
    fn reply<'a>(
        &'a self,
        room_id: &'a str,
        messages: &'a [AiMessage],
    ) -> ow_ai::BoxFuture<'a, Result<ow_ai::Reply, AiError>> {
        Box::pin(ow_ai::collect(self.stream(room_id, messages)))
    }

    fn stream<'a>(
        &'a self,
        _: &'a str,
        _: &'a [AiMessage],
    ) -> BoxStream<'a, Result<AiEvent, AiError>> {
        Box::pin(stream::unfold(&self.0, |held| async move {
            let mut taken = held.lock().await.take()?;
            let event = taken.recv().await;
            *held.lock().await = Some(taken);
            event.map(|event| (event, held))
        }))
    }
}

fn scripted() -> (
    Arc<Scripted>,
    mpsc::UnboundedSender<Result<AiEvent, AiError>>,
) {
    let (sender, receiver) = mpsc::unbounded_channel();
    (Arc::new(Scripted(Mutex::new(Some(receiver)))), sender)
}

async fn app(assistant: Arc<dyn Assistant>) -> (Router, tempfile::TempDir) {
    let data = tempfile::tempdir().unwrap();
    let config = Config {
        host: "127.0.0.1".into(),
        port: 0,
        data_dir: data.path().join("nested"),
        static_dir: data.path().join("static"),
        dev_origins: vec![],
    };
    (
        build_app_with(&config, Some(assistant)).await.unwrap(),
        data,
    )
}

fn streaming(room: &str) -> Request<Body> {
    let body = json!({ "roomId": room, "messages": [{ "id": "m1", "authorId": "you", "content": "hi", "createdAt": 1 }] });
    Request::post("/api/ai/reply")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "text/event-stream")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn plain(room: &str) -> Request<Body> {
    let body = json!({ "roomId": room, "messages": [{ "id": "m1", "authorId": "you", "content": "hi", "createdAt": 1 }] });
    Request::post("/api/ai/reply")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

async fn text_of(response: Response) -> String {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    String::from_utf8(bytes.to_vec()).unwrap()
}

async fn pending(app: &Router) -> Value {
    let response = app
        .clone()
        .oneshot(Request::get("/api/ai/status").body(Body::empty()).unwrap())
        .await
        .unwrap();
    serde_json::from_str::<Value>(&text_of(response).await).unwrap()["pending"].clone()
}

async fn until_pending(app: &Router, expected: Value) {
    for _ in 0..200 {
        if pending(app).await == expected {
            return;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("pending never became {expected}");
}

#[tokio::test]
async fn a_stream_is_started_then_deltas_then_done_with_all_the_text() {
    let (assistant, events) = scripted();
    let (app, _data) = app(assistant).await;
    for event in [
        Ok(AiEvent::Started),
        Ok(AiEvent::Delta("Hel".into())),
        Ok(AiEvent::Delta("lo".into())),
        Ok(AiEvent::Done),
    ] {
        events.send(event).unwrap();
    }
    let response = app.clone().oneshot(streaming("r1")).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers()[header::CONTENT_TYPE]
        .to_str()
        .unwrap()
        .starts_with("text/event-stream"));
    assert_eq!(
        text_of(response).await,
        "event: started\ndata: {}\n\n\
         event: delta\ndata: {\"text\":\"Hel\"}\n\n\
         event: delta\ndata: {\"text\":\"lo\"}\n\n\
         event: done\ndata: {\"text\":\"Hello\"}\n\n"
    );
    assert_eq!(pending(&app).await, json!([]));
}

#[tokio::test]
async fn started_comes_first_even_when_the_plugin_does_not_say_it() {
    let (assistant, events) = scripted();
    let (app, _data) = app(assistant).await;
    for event in [Ok(AiEvent::Delta("Hi".into())), Ok(AiEvent::Done)] {
        events.send(event).unwrap();
    }
    let text = text_of(app.oneshot(streaming("r1")).await.unwrap()).await;
    assert!(text.starts_with("event: started\n"), "{text}");
    assert!(
        text.ends_with("event: done\ndata: {\"text\":\"Hi\"}\n\n"),
        "{text}"
    );
}

#[tokio::test]
async fn an_error_is_one_fixed_message_with_no_internals_and_the_room_is_freed() {
    let (assistant, events) = scripted();
    let (app, _data) = app(assistant).await;
    events.send(Ok(AiEvent::Started)).unwrap();
    events
        .send(Err(AiError::Failed(
            "connect to http://internal.example refused, key=abc123".into(),
        )))
        .unwrap();
    let text = text_of(app.clone().oneshot(streaming("r1")).await.unwrap()).await;
    assert!(
        text.ends_with(
            "event: error\ndata: {\"message\":\"The assistant could not answer. Try again.\"}\n\n"
        ),
        "{text}"
    );
    assert!(!text.contains("internal") && !text.contains("abc123"));
    assert_eq!(pending(&app).await, json!([]));
}

#[tokio::test]
async fn the_room_is_pending_and_a_second_reply_is_409_only_while_the_stream_is_open() {
    let (assistant, events) = scripted();
    let (app, _data) = app(assistant).await;
    let open = app.clone().oneshot(streaming("r1")).await.unwrap();
    assert_eq!(open.status(), StatusCode::OK);
    until_pending(&app, json!(["r1"])).await;
    assert_eq!(
        app.clone().oneshot(streaming("r1")).await.unwrap().status(),
        StatusCode::CONFLICT
    );
    events.send(Ok(AiEvent::Done)).unwrap();
    assert!(text_of(open).await.contains("event: done"));
    assert_eq!(pending(&app).await, json!([]));
}

#[tokio::test]
async fn a_browser_that_leaves_clears_pending() {
    let (assistant, _events) = scripted();
    let (app, _data) = app(assistant).await;
    let open = app.clone().oneshot(streaming("r1")).await.unwrap();
    until_pending(&app, json!(["r1"])).await;
    drop(open);
    until_pending(&app, json!([])).await;
}

#[tokio::test]
async fn a_stream_that_runs_past_the_limit_ends_with_an_error_event() {
    let (assistant, _events) = scripted();
    let router: Router = ow_ai::router_with_timeout(Some(assistant), Duration::from_millis(50));
    let text = text_of(router.oneshot(streaming("r1")).await.unwrap()).await;
    assert_eq!(text, "event: error\ndata: {\"message\":\"The assistant took too long to answer. Try again.\"}\n\n");
}

#[tokio::test]
async fn an_assistant_with_only_reply_still_streams_and_a_plain_request_stays_json() {
    struct Plain;
    impl Assistant for Plain {
        fn reply<'a>(
            &'a self,
            _: &'a str,
            messages: &'a [AiMessage],
        ) -> ow_ai::BoxFuture<'a, Result<ow_ai::Reply, AiError>> {
            Box::pin(async move { Ok(ow_ai::Reply::Text(format!("{} messages", messages.len()))) })
        }
    }
    let (app, _data) = app(Arc::new(Plain)).await;
    let text = text_of(app.clone().oneshot(streaming("r1")).await.unwrap()).await;
    assert_eq!(text, "event: started\ndata: {}\n\nevent: delta\ndata: {\"text\":\"1 messages\"}\n\nevent: done\ndata: {\"text\":\"1 messages\"}\n\n");
    let response = app.oneshot(plain("r1")).await.unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&text_of(response).await).unwrap(),
        json!({ "status": "reply", "text": "1 messages" })
    );
}

#[tokio::test]
async fn an_assistant_with_only_stream_serves_a_plain_request_by_collecting() {
    let (assistant, events) = scripted();
    let (app, _data) = app(assistant).await;
    for event in [
        Ok(AiEvent::Delta("a".into())),
        Ok(AiEvent::Delta("b".into())),
        Ok(AiEvent::Done),
    ] {
        events.send(event).unwrap();
    }
    let response = app.oneshot(plain("r1")).await.unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&text_of(response).await).unwrap(),
        json!({ "status": "reply", "text": "ab" })
    );
}
