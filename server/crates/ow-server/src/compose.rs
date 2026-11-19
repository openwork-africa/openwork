use std::net::SocketAddr;
use std::sync::Arc;

use axum::http::HeaderValue;
use axum::Router;
use ow_ai::Assistant;
use ow_core::CoreError;

use crate::config::Config;
use crate::copy;
use crate::router::{self, AppState};
use crate::session::Sessions;

/// The public server: no AI plugin, so the AI routes answer as if there were none.
pub async fn build_app(config: &Config) -> Result<Router, CoreError> {
    build_app_with(config, None).await
}

/// `build_app` with an assistant registered: the hook a separate crate uses to bring its own.
pub async fn build_app_with(
    config: &Config,
    assistant: Option<Arc<dyn Assistant>>,
) -> Result<Router, CoreError> {
    build_app_with_routes(config, assistant, None).await
}

/// `build_app_with` plus a product's own routes, merged in beside the built-in ones.
pub async fn build_app_with_routes(
    config: &Config,
    assistant: Option<Arc<dyn Assistant>>,
    extra: Option<Router<()>>,
) -> Result<Router, CoreError> {
    let dev_origins = config
        .dev_origins
        .iter()
        .map(|origin| {
            HeaderValue::from_str(origin).map_err(|_| CoreError::Invalid(copy::BAD_ORIGIN.into()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let sessions = Sessions::from_config(config)?;
    let store = ow_store::open(&config.data_dir).await?;
    Ok(router::build_with(
        AppState {
            assistant,
            changes: store.changes,
            files: store.files,
            sessions,
            static_dir: config.static_dir.clone(),
            dev_origins,
        },
        extra,
    ))
}

pub async fn run(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    run_with(config, None).await
}

/// `run` with an assistant registered, for a binary that brings its own plugin.
pub async fn run_with(
    config: Config,
    assistant: Option<Arc<dyn Assistant>>,
) -> Result<(), Box<dyn std::error::Error>> {
    run_with_routes(config, assistant, None).await
}

/// `run_with` plus a product's own routes.
pub async fn run_with_routes(
    config: Config,
    assistant: Option<Arc<dyn Assistant>>,
    extra: Option<Router<()>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = build_app_with_routes(&config, assistant, extra).await?;
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
