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
        let mut config = match fs::read_to_string(path) {
            Ok(contents) => toml::from_str(&contents)?,
            Err(_) => {
                // Return default config if file missing, to be overridden by env vars
                Config {
                    server: ServerConfig {
                        host: "0.0.0.0".to_string(),
                        port: 8080,
                        public_domain: "localhost:8080".to_string(),
                    },
                    database: DatabaseConfig::default(),
                    redis: RedisConfig::default(),
                    limits: LimitsConfig {
                        max_users: 100,
                        max_upload_size_mb: 100,
                    },
                    messages: MessagesConfig {
                        retention: "30d".to_string(),
                    },
                    discovery: DiscoveryConfig {
                        enabled: false,
                        display_name: "Confide Server".to_string(),
                        description: None,
                    },
                }
            }
        };

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

        // Limits overrides
        if let Ok(max_users) = env::var("LIMITS_MAX_USERS") {
            if let Ok(n) = max_users.parse() {
                config.limits.max_users = n;
            }
        }
        if let Ok(max_size) = env::var("LIMITS_MAX_UPLOAD_SIZE_MB") {
            if let Ok(n) = max_size.parse() {
                config.limits.max_upload_size_mb = n;
            }
        }

        // Messages overrides
        if let Ok(retention) = env::var("MESSAGES_RETENTION") {
            config.messages.retention = retention;
        }

        // Discovery overrides
        if let Ok(enabled) = env::var("DISCOVERY_ENABLED") {
            if let Ok(b) = enabled.parse() {
                config.discovery.enabled = b;
            }
        }
        if let Ok(name) = env::var("DISCOVERY_DISPLAY_NAME") {
            config.discovery.display_name = name;
        }
        if let Ok(desc) = env::var("DISCOVERY_DESCRIPTION") {
            config.discovery.description = Some(desc);
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
