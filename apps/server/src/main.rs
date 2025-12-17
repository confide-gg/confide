mod api;
mod config;
mod db;
mod error;
mod federation;
mod models;
mod ws;

use std::sync::Arc;

use axum::http::header;
use axum::middleware;
use axum::routing::get;
use axum::Router;
use reqwest::Client as HttpClient;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use db::Database;
use federation::HeartbeatService;
use ws::ConnectionManager;

pub struct AppState {
    pub db: Database,
    pub config: Config,
    pub http_client: HttpClient,
    pub ws: ConnectionManager,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "confide_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::load("config.toml")?;

    let pool = PgPoolOptions::new()
        .max_connections(config.database.max_connections)
        .connect(&config.database.url)
        .await?;

    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Migrations complete");

    let redis = redis::Client::open(config.redis.url.clone())?;

    let db = Database::new(pool, redis);

    let identity = db.get_server_identity().await?;
    if identity.is_none() {
        run_setup(&db, &config).await?;
    }

    let http_client = HttpClient::new();

    let state = Arc::new(AppState {
        db: db.clone(),
        config: config.clone(),
        http_client,
        ws: ConnectionManager::new(),
    });

    if db.is_setup_complete().await? {
        let heartbeat_service = Arc::new(HeartbeatService::new(
            db.clone(),
            config.server.central_url.clone(),
        ));
        heartbeat_service.start();
        tracing::info!("Heartbeat service started");
    }

    let allowed_origins: Vec<axum::http::HeaderValue> = state
        .config
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
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws::ws_handler))
        .nest("/api", api::routes())
        .layer(middleware::from_fn_with_state(
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
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn run_setup(db: &Database, config: &Config) -> anyhow::Result<()> {
    use confide_sdk::crypto::keys::DsaKeyPair;
    use confide_sdk::encrypt_aes_gcm;
    use rand::RngCore;
    use sha2::{Digest, Sha256};

    tracing::info!("Running first-time setup...");

    let dsa_keypair = DsaKeyPair::generate();

    let mut setup_token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut setup_token_bytes);
    let setup_token = hex::encode(setup_token_bytes);
    let setup_token_hash = Sha256::digest(setup_token_bytes).to_vec();

    let mut encryption_key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut encryption_key);

    let dsa_private_encrypted = encrypt_aes_gcm(&encryption_key, dsa_keypair.secret_bytes())?;

    let display_name =
        std::env::var("DISCOVERY_DISPLAY_NAME").unwrap_or_else(|_| "Confide Server".to_string());
    let description = std::env::var("DISCOVERY_DESCRIPTION").ok();
    let enabled = std::env::var("DISCOVERY_ENABLED")
        .map(|v| v.parse().unwrap_or(false))
        .unwrap_or(false);

    db.create_server_identity(
        display_name,
        description,
        enabled,
        dsa_keypair.public.clone(),
        dsa_private_encrypted,
        setup_token_hash,
    )
    .await?;

    println!();
    println!("================================================");
    println!("CONFIDE SERVER SETUP COMPLETE");
    println!("================================================");
    println!("Owner Token: {}", setup_token);
    println!();
    println!("Register this server via the Confide Client:");
    println!("  1. Log in to your account");
    println!("  2. Click the 'Host a Server' button");
    println!("  3. Enter domain: {}", config.server.public_domain);
    println!("================================================");
    println!();

    Ok(())
}
