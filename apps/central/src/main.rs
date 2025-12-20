mod api;
mod config;
mod crypto;
mod db;
mod error;
mod media;
mod models;
mod s3;
mod spotify_worker;
mod ws;

use axum::extract::DefaultBodyLimit;
use axum::http::header;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tower_http::cors::CorsLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::Database;

pub struct AppState {
    pub db: Database,
    pub redis: redis::Client,
    pub config: Config,
    pub upload_semaphore: Arc<Semaphore>,
    pub s3: s3::S3Service,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "confide_central=debug,tower_http=debug,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::load_auto()?;

    let api_pool = PgPoolOptions::new()
        .max_connections(config.database.api_pool_size)
        .min_connections(config.database.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(
            config.database.acquire_timeout_seconds,
        ))
        .idle_timeout(std::time::Duration::from_secs(
            config.database.idle_timeout_seconds,
        ))
        .max_lifetime(std::time::Duration::from_secs(
            config.database.max_lifetime_seconds,
        ))
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("SET statement_timeout = '30s'")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
        .connect(&config.database.url)
        .await?;
    tracing::info!(
        "connected to PostgreSQL (API pool: {} connections)",
        config.database.api_pool_size
    );

    let ws_pool = PgPoolOptions::new()
        .max_connections(config.database.websocket_pool_size)
        .min_connections(config.database.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(
            config.database.acquire_timeout_seconds,
        ))
        .idle_timeout(std::time::Duration::from_secs(
            config.database.idle_timeout_seconds,
        ))
        .max_lifetime(std::time::Duration::from_secs(
            config.database.max_lifetime_seconds,
        ))
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("SET statement_timeout = '30s'")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
        .connect(&config.database.url)
        .await?;
    tracing::info!(
        "connected to PostgreSQL (WebSocket pool: {} connections)",
        config.database.websocket_pool_size
    );

    sqlx::migrate!("./migrations").run(&api_pool).await?;
    tracing::info!("database migrations complete");

    let redis = redis::Client::open(config.redis.url.clone())?;
    tracing::info!("connected to Redis");

    let upload_semaphore = Arc::new(Semaphore::new(config.uploads.max_concurrent_uploads));

    let s3 = s3::S3Service::new(Arc::new(config.s3.clone())).await?;
    tracing::info!("S3 service initialized");
    tracing::info!(
        "Request body limit set to {} bytes ({} MB)",
        config.s3.max_file_size_bytes,
        config.s3.max_file_size_bytes / 1024 / 1024
    );

    let state = Arc::new(AppState {
        db: Database::new(api_pool, ws_pool, redis.clone()),
        redis,
        config: config.clone(),
        upload_semaphore,
        s3,
    });

    let cleanup_state = state.clone();
    tokio::spawn(async move {
        db::cleanup::run_cleanup_task(cleanup_state).await;
    });

    let call_cleanup_state = state.clone();
    tokio::spawn(async move {
        db::cleanup::run_call_cleanup_task(call_cleanup_state).await;
    });

    let spotify_worker_state = state.clone();
    tokio::spawn(async move {
        spotify_worker::run_spotify_worker(spotify_worker_state).await;
    });

    let nonce_cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5 * 60));
        loop {
            interval.tick().await;
            match nonce_cleanup_state
                .db
                .cleanup_expired_heartbeat_nonces()
                .await
            {
                Ok(count) => {
                    if count > 0 {
                        tracing::debug!("Cleaned up {} expired heartbeat nonces", count);
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to cleanup heartbeat nonces: {}", e);
                }
            }
        }
    });

    if config.calls.enabled {
        let relay_config = media::MediaRelayConfig {
            bind_addr: format!(
                "{}:{}",
                config.calls.relay.bind_host, config.calls.relay.bind_port
            )
            .parse()?,
            max_concurrent_calls: config.calls.relay.max_concurrent_calls,
            token_secret: config.calls.relay.token_secret.clone(),
            cert_path: config.calls.relay.cert_path.clone(),
            key_path: config.calls.relay.key_path.clone(),
        };

        let relay = Arc::new(media::MediaRelay::new(relay_config).await?);
        tokio::spawn(async move {
            if let Err(e) = relay.run().await {
                tracing::error!("Media relay error: {:?}", e);
            }
        });

        tracing::info!(
            "Media relay started on {}:{}",
            config.calls.relay.bind_host,
            config.calls.relay.bind_port
        );
    }

    let allowed_origins: Vec<axum::http::HeaderValue> = config
        .server
        .allowed_origins
        .iter()
        .filter_map(|origin| origin.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("x-conversation-id"),
            axum::http::HeaderName::from_static("x-filename"),
            axum::http::HeaderName::from_static("x-mime-type"),
            axum::http::HeaderName::from_static("x-upload-id"),
            axum::http::HeaderName::from_static("x-chunk-index"),
            axum::http::HeaderName::from_static("x-total-chunks"),
        ])
        .allow_credentials(true);

    let app = Router::new()
        .nest("/api", api::routes())
        .nest("/ws", ws::routes())
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            api::rate_limit::rate_limit_middleware,
        ))
        .layer(cors)
        .layer(SetResponseHeaderLayer::overriding(
            header::CONTENT_SECURITY_POLICY,
            axum::http::HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss:; frame-ancestors 'none'"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            axum::http::HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            axum::http::HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::STRICT_TRANSPORT_SECURITY,
            axum::http::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::REFERRER_POLICY,
            axum::http::HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(DefaultBodyLimit::max(config.s3.max_file_size_bytes))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("server listening on {}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}
