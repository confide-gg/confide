use serde::Deserialize;
use std::{env, fs};

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    #[serde(default)]
    pub database: DatabaseConfig,
    #[serde(default)]
    pub redis: RedisConfig,
    pub limits: LimitsConfig,
    pub messages: MessagesConfig,
    pub discovery: DiscoveryConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub public_domain: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DatabaseConfig {
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct RedisConfig {
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LimitsConfig {
    pub max_users: u32,
    pub max_upload_size_mb: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessagesConfig {
    pub retention: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DiscoveryConfig {
    pub enabled: bool,
    pub display_name: String,
    pub description: Option<String>,
}

fn default_max_connections() -> u32 {
    50
}

impl Config {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let contents = fs::read_to_string(path)?;
        let mut config: Config = toml::from_str(&contents)?;

        if let Ok(url) = env::var("DATABASE_URL") {
            config.database.url = url;
        }

        if let Ok(max_conn) = env::var("DATABASE_MAX_CONNECTIONS") {
            if let Ok(n) = max_conn.parse() {
                config.database.max_connections = n;
            }
        }

        if let Ok(url) = env::var("REDIS_URL") {
            config.redis.url = url;
        }

        if let Ok(host) = env::var("SERVER_HOST") {
            config.server.host = host;
        }

        if let Ok(port) = env::var("SERVER_PORT") {
            if let Ok(p) = port.parse() {
                config.server.port = p;
            }
        }

        if config.database.url.is_empty() {
            anyhow::bail!(
                "DATABASE_URL must be set (either in config.toml or environment variable)"
            );
        }

        if config.redis.url.is_empty() {
            anyhow::bail!("REDIS_URL must be set (either in config.toml or environment variable)");
        }

        Ok(config)
    }
}
