use clap::Parser;
use ow_server::compose;
use ow_server::config::Config;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_target(false).init();
    if let Err(error) = compose::run(Config::parse()).await {
        eprintln!("openwork-server could not start: {error}");
        std::process::exit(1);
    }
}
