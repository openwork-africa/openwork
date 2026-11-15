use std::path::PathBuf;

use clap::Parser;

#[derive(Debug, Clone, Parser)]
#[command(name = "openwork-server", about = "The Openwork sync and file server")]
pub struct Config {
    #[arg(long, env = "OPENWORK_HOST", default_value = "127.0.0.1")]
    pub host: String,
    #[arg(long, env = "OPENWORK_PORT", default_value_t = 47410)]
    pub port: u16,
    #[arg(long = "data", env = "OPENWORK_DATA", default_value = "./data")]
    pub data_dir: PathBuf,
    #[arg(
        long = "static",
        env = "OPENWORK_STATIC",
        default_value = "../app/dist"
    )]
    pub static_dir: PathBuf,
}
