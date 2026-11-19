use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use ow_server::compose::build_app;
use ow_server::config::Config;
use ow_server::session::Sessions;
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

const SECRET: &str = "0123456789abcdef0123456789abcdef";

fn config(data: &TempDir, sessions: bool, secret: Option<&str>) -> Config {
    Config {
        host: "127.0.0.1".into(),
        port: 0,
        data_dir: data.path().join("nested"),
        static_dir: data.path().join("static"),
        dev_origins: vec![],
        sessions,
        session_secret: secret.map(String::from),
        session_ttl_secs: 3600,
    }
}

struct Harness {
    app: Router,
    signer: Sessions,
    _data: TempDir,
}

async fn harness() -> Harness {
    let data = tempfile::tempdir().unwrap();
    Harness {
        app: build_app(&config(&data, true, Some(SECRET))).await.unwrap(),
        signer: Sessions::new(SECRET, 3600).unwrap(),
        _data: data,
    }
}

impl Harness {
    fn cookie(&self, user: &str) -> String {
        format!(
            "openwork_session={}",
            self.signer.create_session(user).unwrap()
        )
    }

    async fn call(
        &self,
        method: &str,
        path: &str,
        cookie: Option<&str>,
        body: Option<Value>,
    ) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
        let mut request = Request::builder().method(method).uri(path);
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        let body = match body {
            Some(value) => {
                request = request.header(header::CONTENT_TYPE, "application/json");
                Body::from(value.to_string())
            }
            None => Body::empty(),
        };
        let response = self
            .app
            .clone()
            .oneshot(request.body(body).unwrap())
            .await
            .unwrap();
        let (status, headers) = (response.status(), response.headers().clone());
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        (status, headers, bytes.to_vec())
    }

    async fn push(&self, cookie: Option<&str>, changes: Value) -> Value {
        let (status, _, bytes) = self
            .call(
                "POST",
                "/api/push",
                cookie,
                Some(json!({ "changes": changes })),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        serde_json::from_slice(&bytes).unwrap()
    }

    async fn pull_ids(&self, cookie: Option<&str>) -> Vec<String> {
        let (status, _, bytes) = self.call("GET", "/api/pull?since=0", cookie, None).await;
        assert_eq!(status, StatusCode::OK);
        let pulled: Value = serde_json::from_slice(&bytes).unwrap();
        pulled["changes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|change| change["id"].as_str().unwrap().to_string())
            .collect()
    }
}

fn room(id: &str, name: &str, updated_at: i64) -> Value {
    json!({ "kind": "room", "id": id, "updatedAt": updated_at, "data": {
        "id": id, "name": name, "createdAt": 1, "updatedAt": updated_at, "activityAt": updated_at } })
}

#[tokio::test]
async fn pull_returns_only_the_callers_changes() {
    let h = harness().await;
    let (alice, bob) = (h.cookie("alice"), h.cookie("bob"));
    h.push(Some(&alice), json!([room("a1", "Alice's", 10)]))
        .await;
    h.push(Some(&bob), json!([room("b1", "Bob's", 10)])).await;
    assert_eq!(h.pull_ids(Some(&alice)).await, ["a1"]);
    assert_eq!(h.pull_ids(Some(&bob)).await, ["b1"]);
}

#[tokio::test]
async fn guests_share_one_pool_apart_from_every_account() {
    let h = harness().await;
    let alice = h.cookie("alice");
    h.push(None, json!([room("g1", "Guest", 10)])).await;
    h.push(Some(&alice), json!([room("a1", "Alice's", 10)]))
        .await;
    assert_eq!(h.pull_ids(None).await, ["g1"]);
    assert_eq!(h.pull_ids(Some(&alice)).await, ["a1"]);
}

#[tokio::test]
async fn another_account_cannot_overwrite_an_id_it_does_not_own() {
    let h = harness().await;
    let (alice, bob) = (h.cookie("alice"), h.cookie("bob"));
    h.push(Some(&alice), json!([room("r1", "Alice's", 10)]))
        .await;
    let answers = h.push(Some(&bob), json!([room("r1", "Bob's", 99)])).await;
    assert_eq!(answers["answers"][0]["ok"], false);
    let (_, _, bytes) = h.call("GET", "/api/pull?since=0", Some(&alice), None).await;
    let pulled: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(pulled["changes"][0]["data"]["name"], "Alice's");
    assert!(h.pull_ids(Some(&bob)).await.is_empty());
}

#[tokio::test]
async fn a_bad_or_expired_cookie_is_refused_not_treated_as_a_guest() {
    let h = harness().await;
    let forged = "openwork_session=v1.616c696365.99999999999.00.00";
    let (status, _, _) = h.call("GET", "/api/pull?since=0", Some(forged), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let short = Sessions::new(SECRET, 0).unwrap();
    let expired = format!(
        "openwork_session={}",
        short.create_session("alice").unwrap()
    );
    let (status, _, _) = h.call("GET", "/api/session", Some(&expired), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn files_are_private_to_their_owner() {
    let h = harness().await;
    let (alice, bob) = (h.cookie("alice"), h.cookie("bob"));
    let put = |cookie: String, body: &'static str| {
        let request = Request::put("/api/files/f1")
            .header(header::COOKIE, cookie)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from(body))
            .unwrap();
        let app = h.app.clone();
        async move { app.oneshot(request).await.unwrap().status() }
    };
    assert_eq!(put(alice.clone(), "mine").await, StatusCode::NO_CONTENT);
    assert_eq!(put(bob.clone(), "yours").await, StatusCode::BAD_REQUEST);
    let (status, _, body) = h.call("GET", "/api/files/f1", Some(&alice), None).await;
    assert_eq!(
        (status, body.as_slice()),
        (StatusCode::OK, b"mine".as_slice())
    );
    let (status, _, _) = h.call("GET", "/api/files/f1", Some(&bob), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _, _) = h.call("GET", "/api/files/f1", None, None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn session_is_401_then_the_user_id_then_logout_clears_it() {
    let h = harness().await;
    let (status, _, _) = h.call("GET", "/api/session", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let cookie = h.cookie("alice");
    let (status, _, bytes) = h.call("GET", "/api/session", Some(&cookie), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        serde_json::from_slice::<Value>(&bytes).unwrap(),
        json!({ "userId": "alice" })
    );
    let (status, headers, _) = h
        .call("POST", "/api/session/logout", Some(&cookie), None)
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let cleared = headers[header::SET_COOKIE].to_str().unwrap();
    assert!(cleared.starts_with("openwork_session=;") && cleared.contains("Max-Age=0"));
    assert!(cleared.contains("HttpOnly"));
}

#[tokio::test]
async fn sessions_on_without_a_secret_does_not_start() {
    let data = tempfile::tempdir().unwrap();
    for secret in [None, Some("short")] {
        let error = build_app(&config(&data, true, secret)).await.unwrap_err();
        assert!(error.to_string().contains("secret"), "{error}");
    }
}

#[tokio::test]
async fn with_sessions_off_every_caller_is_a_guest_and_the_cookie_is_ignored() {
    let data = tempfile::tempdir().unwrap();
    let app = build_app(&config(&data, false, None)).await.unwrap();
    let token = Sessions::new(SECRET, 60)
        .unwrap()
        .create_session("alice")
        .unwrap();
    let request = Request::get("/api/session")
        .header(header::COOKIE, format!("openwork_session={token}"))
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        app.oneshot(request).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
}
