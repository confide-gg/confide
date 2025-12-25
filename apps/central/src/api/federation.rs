use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{FederationUserInfo, RegisteredServer};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register-server", post(register_server))
        .route("/request-token", post(request_token))
        .route("/verify-token", post(verify_token))
        .route("/heartbeat", post(heartbeat))
        .route("/servers", get(get_owned_servers))
        .route("/servers/{server_id}", get(get_server))
        .route("/servers/{server_id}", post(update_server))
}

#[derive(Debug, Deserialize)]
pub struct RegisterServerRequest {
    pub dsa_public_key: Vec<u8>,
    pub domain: String,
    pub display_name: String,
    pub description: Option<String>,
    pub is_discoverable: bool,
}

#[derive(Debug, Serialize)]
pub struct RegisterServerResponse {
    pub server_id: Uuid,
    pub registration_token: String,
}

pub async fn register_server(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<RegisterServerRequest>,
) -> Result<Json<RegisterServerResponse>> {
    if state
        .db
        .get_server_by_public_key(&req.dsa_public_key)
        .await?
        .is_some()
    {
        return Err(AppError::BadRequest(
            "Server with this public key already registered".into(),
        ));
    }

    if state.db.get_server_by_domain(&req.domain).await?.is_some() {
        return Err(AppError::BadRequest(
            "Server with this domain already registered".into(),
        ));
    }

    let server = state
        .db
        .register_server(
            req.dsa_public_key,
            req.domain,
            req.display_name,
            req.description,
            Some(auth.user_id),
            req.is_discoverable,
        )
        .await?;

    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let registration_token = hex::encode(token_bytes);

    Ok(Json(RegisterServerResponse {
        server_id: server.id,
        registration_token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct RequestTokenRequest {
    pub server_domain: String,
}

#[derive(Debug, Serialize)]
pub struct RequestTokenResponse {
    pub token: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub server_info: ServerInfo,
}

#[derive(Debug, Serialize)]
pub struct ServerInfo {
    pub id: Uuid,
    pub domain: String,
    pub display_name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
}

pub async fn request_token(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<RequestTokenRequest>,
) -> Result<Json<RequestTokenResponse>> {
    let server = state
        .db
        .get_server_by_domain(&req.server_domain)
        .await?
        .ok_or(AppError::NotFound("Server not found".into()))?;

    let ten_minutes_ago = Utc::now() - Duration::minutes(10);
    if server.last_heartbeat < ten_minutes_ago {
        return Err(AppError::BadRequest("Server is offline".into()));
    }

    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token = hex::encode(token_bytes);
    let token_hash = Sha256::digest(token_bytes).to_vec();

    let expires_at = Utc::now() + Duration::hours(1);

    state
        .db
        .create_federation_token(auth.user_id, server.id, token_hash.clone(), expires_at)
        .await?;

    Ok(Json(RequestTokenResponse {
        token,
        expires_at,
        server_info: ServerInfo {
            id: server.id,
            domain: server.domain,
            display_name: server.display_name,
            description: server.description,
            icon_url: server.icon_url,
        },
    }))
}

#[derive(Debug, Deserialize)]
pub struct VerifyTokenRequest {
    pub server_id: Uuid,
    pub token_hash: Vec<u8>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct VerifyTokenResponse {
    pub valid: bool,
    pub user_info: Option<FederationUserInfo>,
}

pub async fn verify_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifyTokenRequest>,
) -> Result<Json<VerifyTokenResponse>> {
    tracing::error!(
        "Verifying token for server_id: {}, user_id: {}, hash_len: {}",
        req.server_id,
        req.user_id,
        req.token_hash.len()
    );
    let token_hash_hex = hex::encode(&req.token_hash);
    tracing::debug!("Token hash (hex): {}", token_hash_hex);

    let valid = state
        .db
        .verify_federation_token(req.server_id, &req.token_hash, req.user_id)
        .await
        .map_err(|e| {
            tracing::error!("DB error during token verification: {}", e);
            e
        })?;

    tracing::info!("Token verification result: {}", valid);

    if !valid {
        return Ok(Json(VerifyTokenResponse {
            valid: false,
            user_info: None,
        }));
    }

    let user = state.db.get_public_user(req.user_id).await?;

    let user_info = user.map(|u| FederationUserInfo {
        user_id: u.id,
        username: u.username,
        kem_public_key: u.kem_public_key,
        dsa_public_key: u.dsa_public_key,
    });

    Ok(Json(VerifyTokenResponse {
        valid: true,
        user_info,
    }))
}

#[derive(Debug, Deserialize)]
pub struct HeartbeatRequest {
    pub server_id: Uuid,
    pub member_count: i32,
    pub timestamp: i64,
    pub nonce: Uuid,
    pub signature: Vec<u8>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub is_discoverable: Option<bool>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HeartbeatResponse {
    pub acknowledged: bool,
}

pub async fn heartbeat(
    State(state): State<Arc<AppState>>,
    Json(req): Json<HeartbeatRequest>,
) -> Result<Json<HeartbeatResponse>> {
    let server = state
        .db
        .get_registered_server(req.server_id)
        .await?
        .ok_or(AppError::NotFound("Server not found".into()))?;

    let now = Utc::now().timestamp();
    if (now - req.timestamp).abs() > 300 {
        return Err(AppError::BadRequest(
            "Timestamp too old or in future".into(),
        ));
    }

    let nonce_valid = state
        .db
        .validate_and_store_heartbeat_nonce(req.nonce, req.server_id)
        .await?;

    if !nonce_valid {
        tracing::warn!(
            "Replay attack detected: duplicate nonce {} from server {}",
            req.nonce,
            req.server_id
        );
        return Err(AppError::Unauthorized);
    }

    let message_data = format!(
        "{}:{}:{}:{}",
        req.server_id, req.member_count, req.timestamp, req.nonce
    );

    use confide_sdk::crypto::keys::DsaKeyPair;

    let signature_valid = DsaKeyPair::verify(
        &server.dsa_public_key,
        message_data.as_bytes(),
        &req.signature,
    )
    .unwrap_or(false);

    if !signature_valid {
        return Err(AppError::Unauthorized);
    }

    state
        .db
        .update_server_heartbeat(
            server.id,
            req.member_count,
            req.display_name,
            req.description,
            req.is_discoverable,
            req.icon_url,
        )
        .await?;

    Ok(Json(HeartbeatResponse { acknowledged: true }))
}

pub async fn get_owned_servers(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Vec<RegisteredServer>>> {
    let servers = state.db.get_user_owned_servers(auth.user_id).await?;
    Ok(Json(servers))
}

pub async fn get_server(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(server_id): Path<Uuid>,
) -> Result<Json<RegisteredServer>> {
    let server = state
        .db
        .get_registered_server(server_id)
        .await?
        .ok_or(AppError::NotFound("Server not found".into()))?;

    if server.owner_id != auth.user_id {
        return Err(AppError::Forbidden);
    }

    Ok(Json(server))
}

#[derive(Debug, Deserialize)]
pub struct UpdateServerRequest {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub is_discoverable: Option<bool>,
}

pub async fn update_server(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(server_id): Path<Uuid>,
    Json(req): Json<UpdateServerRequest>,
) -> Result<Json<RegisteredServer>> {
    let server = state
        .db
        .get_registered_server(server_id)
        .await?
        .ok_or(AppError::NotFound("Server not found".into()))?;

    if server.owner_id != auth.user_id {
        return Err(AppError::Forbidden);
    }

    state
        .db
        .update_server_info(
            server_id,
            req.display_name,
            req.description,
            req.icon_url,
            req.is_discoverable,
        )
        .await?;

    let updated_server = state
        .db
        .get_registered_server(server_id)
        .await?
        .ok_or(AppError::NotFound("Server not found".into()))?;

    Ok(Json(updated_server))
}
