mod api;
mod config;
mod crypto;
mod db;
mod error;
mod media;
mod models;
mod ws;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::Database;

pub struct AppState {
    pub db: Database,
    pub redis: redis::Client,
    pub config: Config,
    pub upload_semaphore: Arc<Semaphore>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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

    let state = Arc::new(AppState {
        db: Database::new(api_pool, ws_pool, redis.clone()),
        redis,
        config: config.clone(),
        upload_semaphore,
    });

    let cleanup_state = state.clone();
    tokio::spawn(async move {
        db::cleanup::run_cleanup_task(cleanup_state).await;
    });

    let call_cleanup_state = state.clone();
    tokio::spawn(async move {
        db::cleanup::run_call_cleanup_task(call_cleanup_state).await;
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
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("server listening on {}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}
