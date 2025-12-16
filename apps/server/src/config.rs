use serde::Deserialize;
use std::{env, fs};

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    #[serde(default)]
    pub database: DatabaseConfig,
    #[serde(default)]
    pub redis: RedisConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub public_domain: String,
    #[serde(default = "default_central_url")]
    pub central_url: String,
}

fn default_central_url() -> String {
    if cfg!(debug_assertions) {
        "http://localhost:3000/api".to_string()
    } else {
        "https://central.confide.gg/api".to_string()
    }
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

fn default_max_connections() -> u32 {
    50
}

impl Config {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let mut config = match fs::read_to_string(path) {
            Ok(contents) => toml::from_str(&contents)?,
            Err(_) => {
                // Return default config if file missing, to be overridden by env vars
                Config {
                    server: ServerConfig {
                        host: "0.0.0.0".to_string(),
                        port: 8080,
                        public_domain: "localhost:8080".to_string(),
                        central_url: default_central_url(),
                    },
                    database: DatabaseConfig::default(),
                    redis: RedisConfig::default(),
                }
            }
        };

        // Override central_url from environment if set
        if let Ok(url) = env::var("CENTRAL_API_URL") {
            config.server.central_url = url;
        }

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

        if let Ok(domain) = env::var("SERVER_PUBLIC_DOMAIN") {
            config.server.public_domain = domain;
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
