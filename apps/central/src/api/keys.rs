use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{PendingKeyExchange, PreKeyBundle};
use crate::AppState;

use super::middleware::AuthUser;

async fn publish_to_redis(
    redis: &redis::Client,
    channel: &str,
    message: &str,
) -> std::result::Result<(), redis::RedisError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    redis::cmd("PUBLISH")
        .arg(channel)
        .arg(message)
        .query_async(&mut conn)
        .await
}

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/prekeys", post(upload_prekeys))
        .route("/prekeys/count", get(get_prekey_count))
        .route("/prekeys/{user_id}", get(get_prekey_bundle))
        .route("/exchange", post(initiate_key_exchange))
        .route("/exchange/pending", get(get_pending_exchanges))
        .route("/exchange/{id}/accept", post(accept_key_exchange))
        .route("/sessions/{conversation_id}/{peer_id}", get(get_session))
        .route("/sessions/{conversation_id}/{peer_id}", post(save_session))
}

#[derive(Debug, Deserialize)]
pub struct UploadPrekeysRequest {
    pub signed_prekey_public: Vec<u8>,
    pub signed_prekey_signature: Vec<u8>,
    pub signed_prekey_id: i32,
    pub one_time_prekeys: Vec<OneTimePrekeyUpload>,
}

#[derive(Debug, Deserialize)]
pub struct OneTimePrekeyUpload {
    pub prekey_id: i32,
    pub public_key: Vec<u8>,
}

pub async fn upload_prekeys(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UploadPrekeysRequest>,
) -> Result<Json<serde_json::Value>> {
    state
        .db
        .upsert_user_prekeys(
            auth.user_id,
            req.signed_prekey_public,
            req.signed_prekey_signature,
            req.signed_prekey_id,
        )
        .await?;

    if !req.one_time_prekeys.is_empty() {
        let prekeys: Vec<(i32, Vec<u8>)> = req
            .one_time_prekeys
            .into_iter()
            .map(|p| (p.prekey_id, p.public_key))
            .collect();
        state.db.add_one_time_prekeys(auth.user_id, prekeys).await?;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Serialize)]
pub struct PrekeyCountResponse {
    pub count: i64,
}

pub async fn get_prekey_count(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<PrekeyCountResponse>> {
    let count = state.db.get_one_time_prekey_count(auth.user_id).await?;
    Ok(Json(PrekeyCountResponse { count }))
}

pub async fn get_prekey_bundle(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<PreKeyBundle>> {
    let bundle = state
        .db
        .get_prekey_bundle(user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;
    Ok(Json(bundle))
}

#[derive(Debug, Deserialize)]
pub struct InitiateKeyExchangeRequest {
    pub to_user_id: Uuid,
    pub conversation_id: Uuid,
    pub key_bundle: Vec<u8>,
    pub encrypted_session_state: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct KeyExchangeResponse {
    pub id: Uuid,
}

pub async fn initiate_key_exchange(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<InitiateKeyExchangeRequest>,
) -> Result<Json<KeyExchangeResponse>> {
    state
        .db
        .get_conversation_routing(req.conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let exchange = state
        .db
        .create_pending_key_exchange(
            auth.user_id,
            req.to_user_id,
            req.conversation_id,
            req.key_bundle.clone(),
        )
        .await?;

    state
        .db
        .upsert_ratchet_session(
            auth.user_id,
            req.to_user_id,
            req.conversation_id,
            req.encrypted_session_state,
        )
        .await?;

    let ws_msg = crate::ws::WsMessage::KeyExchange(crate::ws::KeyExchangeData {
        id: exchange.id,
        from_user_id: auth.user_id,
        to_user_id: req.to_user_id,
        conversation_id: req.conversation_id,
        key_bundle: req.key_bundle,
        created_at: exchange.created_at,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("user:{}", req.to_user_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(KeyExchangeResponse { id: exchange.id }))
}

pub async fn get_pending_exchanges(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Vec<PendingKeyExchange>>> {
    let exchanges = state.db.get_pending_key_exchanges(auth.user_id).await?;
    Ok(Json(exchanges))
}

#[derive(Debug, Deserialize)]
pub struct AcceptKeyExchangeRequest {
    pub encrypted_session_state: Vec<u8>,
}

pub async fn accept_key_exchange(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(exchange_id): Path<Uuid>,
    Json(req): Json<AcceptKeyExchangeRequest>,
) -> Result<Json<serde_json::Value>> {
    let exchanges = state.db.get_pending_key_exchanges(auth.user_id).await?;
    let exchange = exchanges
        .into_iter()
        .find(|e| e.id == exchange_id)
        .ok_or(AppError::BadRequest("key exchange not found".into()))?;

    state
        .db
        .upsert_ratchet_session(
            auth.user_id,
            exchange.from_user_id,
            exchange.conversation_id,
            req.encrypted_session_state,
        )
        .await?;

    state.db.delete_pending_key_exchange(exchange_id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub encrypted_state: Vec<u8>,
}

pub async fn get_session(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, peer_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Option<SessionResponse>>> {
    let session = state
        .db
        .get_ratchet_session(auth.user_id, peer_id, conversation_id)
        .await?;
    Ok(Json(session.map(|s| SessionResponse {
        encrypted_state: s.encrypted_state,
    })))
}

#[derive(Debug, Deserialize)]
pub struct SaveSessionRequest {
    pub encrypted_state: Vec<u8>,
}

pub async fn save_session(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, peer_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<SaveSessionRequest>,
) -> Result<Json<serde_json::Value>> {
    state
        .db
        .upsert_ratchet_session(auth.user_id, peer_id, conversation_id, req.encrypted_state)
        .await?;
    Ok(Json(serde_json::json!({ "success": true })))
}
