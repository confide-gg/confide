use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub public_domain: String,
    pub central_url: String,
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

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout_seconds: u64,
    pub idle_timeout_seconds: u64,
    pub max_lifetime_seconds: u64,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            max_connections: default_max_connections(),
            min_connections: default_min_connections(),
            acquire_timeout_seconds: default_acquire_timeout_seconds(),
            idle_timeout_seconds: default_idle_timeout_seconds(),
            max_lifetime_seconds: default_max_lifetime_seconds(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct RedisConfig {
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
    pub fn load() -> anyhow::Result<Self> {
        let mut server = ServerConfig {
            host: "0.0.0.0".to_string(),
            port: 8080,
            public_domain: "localhost:8080".to_string(),
            central_url: default_central_url(),
            allowed_origins: default_allowed_origins(),
        };
        let mut database = DatabaseConfig::default();
        let mut redis = RedisConfig::default();

        if let Ok(url) = env::var("CENTRAL_API_URL") {
            server.central_url = url;
        }

        if let Ok(url) = env::var("DATABASE_URL") {
            database.url = url;
        }

        if let Ok(max_conn) = env::var("DATABASE_MAX_CONNECTIONS") {
            if let Ok(n) = max_conn.parse() {
                database.max_connections = n;
            }
        }

        if let Ok(url) = env::var("REDIS_URL") {
            redis.url = url;
        }

        if let Ok(host) = env::var("SERVER_HOST") {
            server.host = host;
        }

        if let Ok(port) = env::var("SERVER_PORT") {
            if let Ok(p) = port.parse() {
                server.port = p;
            }
        }

        if let Ok(domain) = env::var("SERVER_PUBLIC_DOMAIN") {
            server.public_domain = domain;
        }

        if let Ok(origins) = env::var("ALLOWED_ORIGINS") {
            server.allowed_origins = origins.split(',').map(|s| s.trim().to_string()).collect();
        }

        if database.url.is_empty() {
            anyhow::bail!("DATABASE_URL environment variable must be set");
        }

        if redis.url.is_empty() {
            anyhow::bail!("REDIS_URL environment variable must be set");
        }

        let security = SecurityConfig::load()?;

        let config = Config {
            server,
            database,
            redis,
            security,
        };

        tracing::info!(
            "Configuration loaded from environment variables. Server: {}:{}, Central: {}",
            config.server.host,
            config.server.port,
            config.server.central_url
        );

        Ok(config)
    }
}
