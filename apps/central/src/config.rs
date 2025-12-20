use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub auth: AuthConfig,
    pub messages: MessagesConfig,
    pub crypto: CryptoConfig,
    pub websocket: WebSocketConfig,
    pub uploads: UploadsConfig,
    #[serde(default)]
    pub calls: CallsConfig,
    pub s3: S3Config,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    #[serde(default = "default_api_pool_size")]
    pub api_pool_size: u32,
    #[serde(default = "default_websocket_pool_size")]
    pub websocket_pool_size: u32,
    #[serde(default = "default_min_connections")]
    pub min_connections: u32,
    #[serde(default = "default_acquire_timeout_seconds")]
    pub acquire_timeout_seconds: u64,
    #[serde(default = "default_idle_timeout_seconds")]
    pub idle_timeout_seconds: u64,
    #[serde(default = "default_max_lifetime_seconds")]
    pub max_lifetime_seconds: u64,
}

fn default_api_pool_size() -> u32 {
    let cores = num_cpus::get() as u32;
    (cores * 2 + 5).clamp(10, 40)
}

fn default_websocket_pool_size() -> u32 {
    let cores = num_cpus::get() as u32;
    (cores * 2).clamp(10, 30)
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

#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    pub token_expiry_hours: u64,
    pub password_min_length: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessagesConfig {
    pub ttl_days: u32,
    pub cleanup_interval_hours: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CryptoConfig {
    pub argon2_memory_kib: u32,
    pub argon2_iterations: u32,
    pub argon2_parallelism: u32,
}

impl CryptoConfig {
    pub fn to_argon2_config(&self) -> confide_sdk::Argon2Config {
        confide_sdk::Argon2Config {
            memory_kib: self.argon2_memory_kib,
            iterations: self.argon2_iterations,
            parallelism: self.argon2_parallelism,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct WebSocketConfig {
    pub message_buffer_size: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadsConfig {
    pub max_concurrent_uploads: usize,
    pub max_uploads_per_hour: u32,
    pub retention_days: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct S3Config {
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    #[serde(default = "default_s3_presigned_url_expiry")]
    pub presigned_url_expiry_seconds: u64,
    #[serde(default = "default_s3_max_file_size")]
    pub max_file_size_bytes: usize,
}

fn default_s3_presigned_url_expiry() -> u64 {
    3600
}

fn default_s3_max_file_size() -> usize {
    104_857_600
}

#[derive(Debug, Clone, Deserialize)]
pub struct CallsConfig {
    #[serde(default = "default_calls_enabled")]
    pub enabled: bool,
    #[serde(default = "default_max_call_duration")]
    pub max_call_duration_minutes: u64,
    #[serde(default = "default_ring_timeout")]
    pub ring_timeout_seconds: u64,
    #[serde(default)]
    pub relay: RelayConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayConfig {
    #[serde(default = "default_relay_host")]
    pub bind_host: String,
    #[serde(default = "default_relay_port")]
    pub bind_port: u16,
    #[serde(default = "default_relay_public_host")]
    pub public_host: String,
    #[serde(default = "default_max_concurrent_calls")]
    pub max_concurrent_calls: usize,
    #[serde(default)]
    pub token_secret: String,
    #[serde(default = "default_cert_path")]
    pub cert_path: Option<String>,
    #[serde(default = "default_key_path")]
    pub key_path: Option<String>,
}

fn default_calls_enabled() -> bool {
    true
}

fn default_max_call_duration() -> u64 {
    120
}

fn default_ring_timeout() -> u64 {
    30
}

fn default_relay_host() -> String {
    "0.0.0.0".to_string()
}

fn default_relay_port() -> u16 {
    10000
}

fn default_relay_public_host() -> String {
    "localhost".to_string()
}

fn default_max_concurrent_calls() -> usize {
    1000
}

fn default_cert_path() -> Option<String> {
    None
}

fn default_key_path() -> Option<String> {
    None
}

impl Default for RelayConfig {
    fn default() -> Self {
        Self {
            bind_host: default_relay_host(),
            bind_port: default_relay_port(),
            public_host: default_relay_public_host(),
            max_concurrent_calls: default_max_concurrent_calls(),
            token_secret: String::new(),
            cert_path: None,
            key_path: None,
        }
    }
}

impl Default for CallsConfig {
    fn default() -> Self {
        Self {
            enabled: default_calls_enabled(),
            max_call_duration_minutes: default_max_call_duration(),
            ring_timeout_seconds: default_ring_timeout(),
            relay: RelayConfig::default(),
        }
    }
}

impl Config {
    pub fn load_from_env() -> anyhow::Result<Self> {
        let _ = dotenvy::dotenv();

        let server = ServerConfig {
            host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000),
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| {
                    "http://localhost:3000,http://127.0.0.1:3000,tauri://localhost".to_string()
                })
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
        };

        let database = DatabaseConfig {
            url: env::var("DATABASE_URL")?,
            max_connections: env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(50),
            api_pool_size: env::var("DB_API_POOL_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_api_pool_size),
            websocket_pool_size: env::var("DB_WEBSOCKET_POOL_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_websocket_pool_size),
            min_connections: env::var("DB_MIN_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_min_connections),
            acquire_timeout_seconds: env::var("DB_ACQUIRE_TIMEOUT_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_acquire_timeout_seconds),
            idle_timeout_seconds: env::var("DB_IDLE_TIMEOUT_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_idle_timeout_seconds),
            max_lifetime_seconds: env::var("DB_MAX_LIFETIME_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_max_lifetime_seconds),
        };

        let redis = RedisConfig {
            url: env::var("REDIS_URL")?,
        };

        let auth = AuthConfig {
            token_expiry_hours: env::var("AUTH_TOKEN_EXPIRY_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(168),
            password_min_length: env::var("AUTH_PASSWORD_MIN_LENGTH")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8),
        };

        let messages = MessagesConfig {
            ttl_days: env::var("MESSAGES_TTL_DAYS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            cleanup_interval_hours: env::var("MESSAGES_CLEANUP_INTERVAL_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
        };

        let crypto = CryptoConfig {
            argon2_memory_kib: env::var("CRYPTO_ARGON2_MEMORY_KIB")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(65536),
            argon2_iterations: env::var("CRYPTO_ARGON2_ITERATIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3),
            argon2_parallelism: env::var("CRYPTO_ARGON2_PARALLELISM")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(4),
        };

        let websocket = WebSocketConfig {
            message_buffer_size: env::var("WEBSOCKET_MESSAGE_BUFFER_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(128),
        };

        let uploads = UploadsConfig {
            max_concurrent_uploads: env::var("UPLOADS_MAX_CONCURRENT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10),
            max_uploads_per_hour: env::var("UPLOADS_MAX_PER_HOUR")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10),
            retention_days: env::var("UPLOADS_RETENTION_DAYS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(90),
        };

        let s3 = S3Config {
            endpoint: env::var("S3_ENDPOINT")?,
            region: env::var("S3_REGION")?,
            bucket: env::var("S3_BUCKET")?,
            access_key_id: env::var("S3_ACCESS_KEY_ID")?,
            secret_access_key: env::var("S3_SECRET_ACCESS_KEY")?,
            presigned_url_expiry_seconds: env::var("S3_PRESIGNED_URL_EXPIRY")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_s3_presigned_url_expiry),
            max_file_size_bytes: env::var("S3_MAX_FILE_SIZE_BYTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_s3_max_file_size),
        };

        let relay = RelayConfig {
            bind_host: env::var("CALLS_RELAY_BIND_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            bind_port: env::var("CALLS_RELAY_BIND_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(10000),
            public_host: env::var("CALLS_RELAY_PUBLIC_HOST")
                .unwrap_or_else(|_| "localhost".to_string()),
            max_concurrent_calls: env::var("CALLS_RELAY_MAX_CONCURRENT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1000),
            token_secret: env::var("CALLS_RELAY_TOKEN_SECRET")?,
            cert_path: env::var("CALLS_RELAY_CERT_PATH").ok(),
            key_path: env::var("CALLS_RELAY_KEY_PATH").ok(),
        };

        let calls = CallsConfig {
            enabled: env::var("CALLS_ENABLED")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(true),
            max_call_duration_minutes: env::var("CALLS_MAX_DURATION_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(120),
            ring_timeout_seconds: env::var("CALLS_RING_TIMEOUT_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            relay,
        };

        Ok(Config {
            server,
            database,
            redis,
            auth,
            messages,
            crypto,
            websocket,
            uploads,
            calls,
            s3,
        })
    }

    pub fn load_auto() -> anyhow::Result<Self> {
        let _ = dotenvy::dotenv();
        tracing::info!("Loading configuration from environment variables");
        Self::load_from_env()
    }
}
