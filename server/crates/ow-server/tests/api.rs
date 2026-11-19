use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use axum::Router;
use ow_server::compose::build_app;
use ow_server::config::Config;
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

struct Harness {
    app: Router,
    _data: TempDir,
    static_dir: TempDir,
}

async fn harness() -> Harness {
    let data = tempfile::tempdir().unwrap();
    let static_dir = tempfile::tempdir().unwrap();
    let config = Config {
        host: "127.0.0.1".into(),
        port: 0,
        data_dir: data.path().join("nested"),
        static_dir: static_dir.path().to_path_buf(),
        dev_origins: vec![
            "http://127.0.0.1:47411".into(),
            "http://localhost:47411".into(),
        ],
        sessions: false,
        session_secret: None,
        session_ttl_secs: 60,
    };
    Harness {
        app: build_app(&config).await.unwrap(),
        _data: data,
        static_dir,
    }
}

async fn send(
    app: &Router,
    request: Request<Body>,
) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, headers, bytes.to_vec())
}

async fn get(app: &Router, path: &str) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
    send(app, Request::get(path).body(Body::empty()).unwrap()).await
}

async fn push(app: &Router, changes: Value) -> Value {
    let request = Request::post("/api/push")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "changes": changes }).to_string()))
        .unwrap();
    let (status, _, bytes) = send(app, request).await;
    assert_eq!(status, StatusCode::OK);
    serde_json::from_slice(&bytes).unwrap()
}

async fn pull(app: &Router, since: u64) -> Value {
    let (status, _, bytes) = get(app, &format!("/api/pull?since={since}")).await;
    assert_eq!(status, StatusCode::OK);
    serde_json::from_slice(&bytes).unwrap()
}

fn room(id: &str, name: &str, updated_at: i64, deleted: bool) -> Value {
    let mut data = json!({
        "id": id, "name": name, "createdAt": 1, "updatedAt": updated_at, "activityAt": updated_at
    });
    if deleted {
        data["deleted"] = json!(true);
    }
    json!({ "kind": "room", "id": id, "updatedAt": updated_at, "data": data })
}

fn message(id: &str, content: &str, updated_at: i64) -> Value {
    json!({ "kind": "message", "id": id, "updatedAt": updated_at, "data": {
        "id": id, "roomId": "r1", "authorId": "you", "content": content,
        "createdAt": 1, "updatedAt": updated_at } })
}

#[tokio::test]
async fn healthz_answers_ok() {
    let h = harness().await;
    let (status, _, body) = get(&h.app, "/healthz").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, b"ok");
}

#[tokio::test]
async fn push_then_pull_round_trips_every_kind() {
    let h = harness().await;
    let file = json!({ "kind": "file", "id": "f1", "updatedAt": 5, "data": {
        "id": "f1", "parentId": "r1", "name": "a.txt", "mimeType": "text/plain",
        "size": 3, "createdAt": 5, "updatedAt": 5 } });
    let changes = json!([
        room("r1", "Family", 10, false),
        message("m1", "hi", 11),
        file
    ]);
    let answers = push(&h.app, changes.clone()).await;
    assert_eq!(
        answers,
        json!({ "answers": [
            { "id": "r1", "ok": true }, { "id": "m1", "ok": true }, { "id": "f1", "ok": true }
        ] })
    );
    let pulled = pull(&h.app, 0).await;
    assert_eq!(pulled["changes"], changes);
    assert_eq!(pulled["cursor"], 3);
}

#[tokio::test]
async fn cursor_advances_and_pull_returns_only_newer_changes() {
    let h = harness().await;
    push(&h.app, json!([room("r1", "One", 10, false)])).await;
    let first = pull(&h.app, 0).await;
    assert_eq!(first["cursor"], 1);
    push(&h.app, json!([message("m1", "hi", 11)])).await;
    let second = pull(&h.app, 1).await;
    assert_eq!(second["cursor"], 2);
    assert_eq!(second["changes"].as_array().unwrap().len(), 1);
    assert_eq!(second["changes"][0]["id"], "m1");
    let empty = pull(&h.app, 2).await;
    assert_eq!(empty["changes"], json!([]));
    assert_eq!(empty["cursor"], 2);
}

#[tokio::test]
async fn older_change_is_answered_ok_and_ignored() {
    let h = harness().await;
    push(&h.app, json!([room("r1", "New", 20, false)])).await;
    let answers = push(&h.app, json!([room("r1", "Old", 10, false)])).await;
    assert_eq!(answers["answers"][0], json!({ "id": "r1", "ok": true }));
    let pulled = pull(&h.app, 0).await;
    assert_eq!(pulled["changes"][0]["data"]["name"], "New");
    assert_eq!(pulled["cursor"], 1);
}

#[tokio::test]
async fn newer_change_wins_and_gets_a_new_sequence_number() {
    let h = harness().await;
    push(&h.app, json!([room("r1", "Old", 10, false)])).await;
    push(&h.app, json!([room("r1", "New", 20, false)])).await;
    let pulled = pull(&h.app, 0).await;
    assert_eq!(pulled["changes"].as_array().unwrap().len(), 1);
    assert_eq!(pulled["changes"][0]["data"]["name"], "New");
    assert_eq!(pulled["cursor"], 2);
}

#[tokio::test]
async fn deleted_flag_is_carried() {
    let h = harness().await;
    push(&h.app, json!([room("r1", "Gone", 10, false)])).await;
    push(&h.app, json!([room("r1", "Gone", 20, true)])).await;
    let pulled = pull(&h.app, 0).await;
    assert_eq!(pulled["changes"][0]["data"]["deleted"], true);
}

#[tokio::test]
async fn bad_change_is_refused_in_plain_words_without_blocking_others() {
    let h = harness().await;
    let mismatched = json!({ "kind": "room", "id": "x", "updatedAt": 1, "data": room("y", "n", 1, false)["data"] });
    let answers = push(&h.app, json!([mismatched, room("r1", "Fine", 3, false)])).await;
    assert_eq!(answers["answers"][0]["ok"], false);
    assert!(answers["answers"][0]["message"].as_str().unwrap().len() > 5);
    assert_eq!(answers["answers"][1], json!({ "id": "r1", "ok": true }));
}

#[tokio::test]
async fn files_round_trip_with_content_type_and_missing_is_404() {
    let h = harness().await;
    let put = Request::builder()
        .method(Method::PUT)
        .uri("/api/files/abc-123")
        .header(header::CONTENT_TYPE, "image/png")
        .body(Body::from(vec![1u8, 2, 3, 4]))
        .unwrap();
    let (status, _, _) = send(&h.app, put).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, headers, body) = get(&h.app, "/api/files/abc-123").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers[header::CONTENT_TYPE], "image/png");
    assert_eq!(body, vec![1u8, 2, 3, 4]);
    let (status, _, body) = get(&h.app, "/api/files/nope").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(serde_json::from_slice::<Value>(&body).unwrap()["message"].is_string());
}

#[tokio::test]
async fn oversized_file_is_413_with_a_plain_message() {
    let h = harness().await;
    let put = Request::builder()
        .method(Method::PUT)
        .uri("/api/files/big")
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .body(Body::from(vec![0u8; 25 * 1024 * 1024 + 1]))
        .unwrap();
    let (status, _, body) = send(&h.app, put).await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert!(String::from_utf8(body).unwrap().contains("25 MB"));
}

#[tokio::test]
async fn unknown_api_route_is_404_json() {
    let h = harness().await;
    for path in ["/api/nothing", "/api/files", "/api"] {
        let (status, headers, body) = get(&h.app, path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert!(headers[header::CONTENT_TYPE]
            .to_str()
            .unwrap()
            .starts_with("application/json"));
        assert!(serde_json::from_slice::<Value>(&body).unwrap()["message"].is_string());
    }
}

#[tokio::test]
async fn static_files_and_spa_fallback() {
    let h = harness().await;
    std::fs::write(h.static_dir.path().join("index.html"), "<html>shell</html>").unwrap();
    std::fs::create_dir(h.static_dir.path().join("assets")).unwrap();
    std::fs::write(h.static_dir.path().join("assets/app.js"), "console.log(1)").unwrap();
    let (status, _, body) = get(&h.app, "/assets/app.js").await;
    assert_eq!((status, body), (StatusCode::OK, b"console.log(1)".to_vec()));
    for path in ["/", "/c/abc", "/profile"] {
        let (status, _, body) = get(&h.app, path).await;
        assert_eq!(status, StatusCode::OK, "{path}");
        assert_eq!(body, b"<html>shell</html>");
    }
}

#[tokio::test]
async fn missing_frontend_answers_503_in_plain_words() {
    let h = harness().await;
    let (status, _, body) = get(&h.app, "/").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(String::from_utf8(body).unwrap().contains("not built"));
}

#[tokio::test]
async fn cors_allows_the_vite_dev_origin_only() {
    let h = harness().await;
    let allowed = Request::get("/healthz")
        .header(header::ORIGIN, "http://localhost:47411")
        .body(Body::empty())
        .unwrap();
    let (_, headers, _) = send(&h.app, allowed).await;
    assert_eq!(
        headers[header::ACCESS_CONTROL_ALLOW_ORIGIN],
        "http://localhost:47411"
    );
    let other = Request::get("/healthz")
        .header(header::ORIGIN, "http://evil.example")
        .body(Body::empty())
        .unwrap();
    let (_, headers, _) = send(&h.app, other).await;
    assert!(!headers.contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN));
}

#[tokio::test]
async fn a_room_keeps_its_members_and_their_unknown_types() {
    let h = harness().await;
    let mut with_members = room("r9", "Mixed", 10, false);
    with_members["data"]["members"] = json!([
        { "id": "o1", "name": "Helper", "type": "operator", "description": "Answers" },
        { "id": "p1", "name": "Ama", "type": "x-unknown-type" }
    ]);
    push(&h.app, json!([with_members.clone()])).await;
    let pulled = pull(&h.app, 0).await;
    assert_eq!(
        pulled["changes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["id"] == "r9")
            .unwrap(),
        &with_members
    );
}

#[tokio::test]
async fn an_unknown_message_kind_and_a_missing_kind_come_back_unchanged() {
    let h = harness().await;
    let mut tagged = message("m1", "four options", 10);
    tagged["data"]["kind"] = json!("x-unknown-kind");
    let plain = message("m2", "hello", 11);
    push(&h.app, json!([tagged.clone(), plain.clone()])).await;
    let pulled = pull(&h.app, 0).await;
    let changes = pulled["changes"].as_array().unwrap();
    assert_eq!(changes.iter().find(|c| c["id"] == "m1").unwrap(), &tagged);
    assert_eq!(changes.iter().find(|c| c["id"] == "m2").unwrap(), &plain);
}
