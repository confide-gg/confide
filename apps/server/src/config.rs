use serde::Deserialize;
use std::{env, fs};

#[derive(Debug, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone, Deserialize)]
struct ConfigFile {
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
    (cores * 2 + 5).clamp(10, 50)
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

#[derive(Debug, Clone)]
pub struct SecurityConfig {
    pub dsa_encryption_key: [u8; 32],
}

impl SecurityConfig {
    pub fn load() -> anyhow::Result<Self> {
        let key_hex = env::var("DSA_ENCRYPTION_KEY").map_err(|_| {
            anyhow::anyhow!(
                "CRITICAL: DSA_ENCRYPTION_KEY environment variable not set. \
                 Server cannot start without encryption key."
            )
        })?;

        if key_hex.len() != 64 {
            anyhow::bail!(
                "CRITICAL: DSA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)"
            );
        }

        let key_bytes = hex::decode(&key_hex).map_err(|_| {
            anyhow::anyhow!("CRITICAL: DSA_ENCRYPTION_KEY contains invalid hexadecimal characters")
        })?;

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);

        Ok(Self {
            dsa_encryption_key: key,
        })
    }
}

impl Config {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let mut config_file = match fs::read_to_string(path) {
            Ok(contents) => toml::from_str::<ConfigFile>(&contents)?,
            Err(_) => ConfigFile {
                server: ServerConfig {
                    host: "0.0.0.0".to_string(),
                    port: 8080,
                    public_domain: "localhost:8080".to_string(),
                    central_url: default_central_url(),
                    allowed_origins: default_allowed_origins(),
                },
                database: DatabaseConfig::default(),
                redis: RedisConfig::default(),
            },
        };

        if let Ok(url) = env::var("CENTRAL_API_URL") {
            config_file.server.central_url = url;
        }

        if let Ok(url) = env::var("DATABASE_URL") {
            config_file.database.url = url;
        }

        if let Ok(max_conn) = env::var("DATABASE_MAX_CONNECTIONS") {
            if let Ok(n) = max_conn.parse() {
                config_file.database.max_connections = n;
            }
        }

        if let Ok(url) = env::var("REDIS_URL") {
            config_file.redis.url = url;
        }

        if let Ok(host) = env::var("SERVER_HOST") {
            config_file.server.host = host;
        }

        if let Ok(port) = env::var("SERVER_PORT") {
            if let Ok(p) = port.parse() {
                config_file.server.port = p;
            }
        }

        if let Ok(domain) = env::var("SERVER_PUBLIC_DOMAIN") {
            config_file.server.public_domain = domain;
        }

        if let Ok(origins) = env::var("ALLOWED_ORIGINS") {
            config_file.server.allowed_origins =
                origins.split(',').map(|s| s.trim().to_string()).collect();
        }

        if config_file.database.url.is_empty() {
            anyhow::bail!(
                "DATABASE_URL must be set (either in config.toml or environment variable)"
            );
        }

        if config_file.redis.url.is_empty() {
            anyhow::bail!("REDIS_URL must be set (either in config.toml or environment variable)");
        }

        let security = SecurityConfig::load()?;

        Ok(Config {
            server: config_file.server,
            database: config_file.database,
            redis: config_file.redis,
            security,
        })
    }
}
