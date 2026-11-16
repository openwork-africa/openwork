use std::net::SocketAddr;

use axum::http::HeaderValue;
use axum::Router;
use ow_core::CoreError;

use crate::config::Config;
use crate::copy;
use crate::router::{self, AppState};

pub async fn build_app(config: &Config) -> Result<Router, CoreError> {
    let dev_origins = config
        .dev_origins
        .iter()
        .map(|origin| {
            HeaderValue::from_str(origin).map_err(|_| CoreError::Invalid(copy::BAD_ORIGIN.into()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let store = ow_store::open(&config.data_dir).await?;
    Ok(router::build(AppState {
        changes: store.changes,
        files: store.files,
        static_dir: config.static_dir.clone(),
        dev_origins,
    }))
}

pub async fn run(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let app = build_app(&config).await?;
    let address: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!("openwork-server listening on http://{address}");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
