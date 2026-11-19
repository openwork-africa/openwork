use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::routing::get;
use axum::Router;
use ow_server::compose::{build_app, build_app_with_routes};
use ow_server::config::Config;
use tower::ServiceExt;

fn config(dir: &std::path::Path) -> Config {
    Config {
        host: "127.0.0.1".into(),
        port: 0,
        data_dir: dir.join("nested"),
        static_dir: dir.join("static"),
        dev_origins: vec![],
        sessions: false,
        session_secret: None,
        session_ttl_secs: 3600,
    }
}

async fn status_of(app: Router, path: &str) -> (StatusCode, Vec<u8>) {
    let response = app
        .oneshot(Request::get(path).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, bytes.to_vec())
}

#[tokio::test]
async fn an_extra_route_is_served_by_the_app_built_with_it() {
    let data = tempfile::tempdir().unwrap();
    let extra = Router::new().route("/api/hello", get(|| async { "hi" }));
    let app = build_app_with_routes(&config(data.path()), None, Some(extra))
        .await
        .unwrap();
    assert_eq!(
        status_of(app.clone(), "/api/hello").await,
        (StatusCode::OK, b"hi".to_vec())
    );
    assert_eq!(
        status_of(app, "/healthz").await.0,
        StatusCode::OK,
        "built-in routes stay"
    );
}

#[tokio::test]
async fn the_default_app_has_no_extra_route() {
    let data = tempfile::tempdir().unwrap();
    let app = build_app(&config(data.path())).await.unwrap();
    assert_eq!(status_of(app, "/api/hello").await.0, StatusCode::NOT_FOUND);
}
