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
    #[serde(default = "default_allowed_origins")]
    pub allowed_origins: Vec<String>,
}

fn default_central_url() -> String {
    if cfg!(debug_assertions) {
        "http://localhost:3000/api".to_string()
    } else {
        "https://central.confide.gg/api".to_string()
    }
}

fn default_allowed_origins() -> Vec<String> {
    vec![
        "http://localhost:3000".to_string(),
        "http://127.0.0.1:3000".to_string(),
        "tauri://localhost".to_string(),
    ]
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DatabaseConfig {
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
    #[serde(default = "default_min_connections")]
    pub min_connections: u32,
    #[serde(default = "default_acquire_timeout_seconds")]
    pub acquire_timeout_seconds: u64,
    #[serde(default = "default_idle_timeout_seconds")]
    pub idle_timeout_seconds: u64,
    #[serde(default = "default_max_lifetime_seconds")]
    pub max_lifetime_seconds: u64,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct RedisConfig {
    #[serde(default)]
    pub url: String,
}

fn default_max_connections() -> u32 {
    let cores = num_cpus::get() as u32;
    (cores * 2 + 5).min(50).max(10)
}

fn default_min_connections() -> u32 {
    5
}

fn default_acquire_timeout_seconds() -> u64 {
    5
}

fn default_idle_timeout_seconds() -> u64 {
    300
}

fn default_max_lifetime_seconds() -> u64 {
    1800
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
                        allowed_origins: default_allowed_origins(),
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

        if let Ok(origins) = env::var("ALLOWED_ORIGINS") {
            config.server.allowed_origins =
                origins.split(',').map(|s| s.trim().to_string()).collect();
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
