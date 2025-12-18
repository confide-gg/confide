use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post},
    Json, Router,
};
use confide_sdk::crypto::keys::DsaKeyPair;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{permissions, Message};
use crate::ws::types::ServerMessage;
use crate::AppState;

use super::middleware::AuthMember;

const MAX_ENCRYPTED_MESSAGE_BYTES: usize = 256 * 1024;
const MAX_SIGNATURE_BYTES: usize = 8 * 1024;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/{channel_id}", post(send_message))
        .route("/{channel_id}", get(get_messages))
        .route("/{channel_id}/{message_id}", delete(delete_message))
}

#[derive(Debug, Clone, Serialize)]
pub struct MessageWithKey {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub sender_id: Uuid,
    pub sender_username: String,
    pub sender_dsa_public_key: Vec<u8>,
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: Message,
}

pub async fn send_message(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<MessageResponse>> {
    tracing::debug!(
        "send_message called by member_id={}, channel_id={}",
        auth.member_id,
        channel_id
    );

    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::SEND_MESSAGES) {
        return Err(AppError::Forbidden);
    }

    if req.encrypted_content.is_empty() || req.encrypted_content.len() > MAX_ENCRYPTED_MESSAGE_BYTES
    {
        return Err(AppError::BadRequest("Invalid message size".into()));
    }
    if req.signature.is_empty() || req.signature.len() > MAX_SIGNATURE_BYTES {
        return Err(AppError::BadRequest("Invalid signature size".into()));
    }

    let sender = state
        .db
        .get_member(auth.member_id)
        .await?
        .ok_or(AppError::NotFound("Member not found".into()))?;

    let signature_valid = DsaKeyPair::verify(
        &sender.dsa_public_key,
        &req.encrypted_content,
        &req.signature,
    )
    .unwrap_or(false);

    if !signature_valid {
        return Err(AppError::BadRequest("Signature verification failed".into()));
    }

    state
        .db
        .get_channel(channel_id)
        .await?
        .ok_or(AppError::NotFound("Channel not found".into()))?;

    let message = state
        .db
        .create_message(
            channel_id,
            auth.member_id,
            req.encrypted_content,
            req.signature,
            req.reply_to_id,
        )
        .await?;

    tracing::debug!("Message created with id={}", message.id);

    let broadcast_message = MessageWithKey {
        id: message.id,
        channel_id: message.channel_id,
        sender_id: message.sender_id,
        sender_username: sender.username.clone(),
        sender_dsa_public_key: sender.dsa_public_key.clone(),
        encrypted_content: message.encrypted_content.clone(),
        signature: message.signature.clone(),
        reply_to_id: message.reply_to_id,
        created_at: message.created_at,
    };

    let connections = state.ws.get_subscribed_members(channel_id).await;
    for member_id in connections {
        state
            .ws
            .send_to_member(
                member_id,
                ServerMessage::NewMessage {
                    message: broadcast_message.clone(),
                },
            )
            .await;
    }

    tracing::debug!("Message send complete");
    Ok(Json(MessageResponse { message }))
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub before: Option<chrono::DateTime<chrono::Utc>>,
}

fn default_limit() -> i64 {
    50
}

pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(channel_id): Path<Uuid>,
    Query(query): Query<GetMessagesQuery>,
) -> Result<Json<Vec<MessageWithKey>>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::READ_MESSAGES) {
        return Err(AppError::Forbidden);
    }

    state
        .db
        .get_channel(channel_id)
        .await?
        .ok_or(AppError::NotFound("Channel not found".into()))?;

    let limit = query.limit.clamp(1, 100);
    let messages_with_senders = state
        .db
        .get_channel_messages_with_senders(channel_id, limit, query.before)
        .await?;

    let messages_with_keys = messages_with_senders
        .into_iter()
        .map(|(msg, sender)| MessageWithKey {
            id: msg.id,
            channel_id: msg.channel_id,
            sender_id: msg.sender_id,
            sender_username: sender.username,
            sender_dsa_public_key: sender.dsa_public_key,
            encrypted_content: msg.encrypted_content,
            signature: msg.signature,
            reply_to_id: msg.reply_to_id,
            created_at: msg.created_at,
        })
        .collect();

    Ok(Json(messages_with_keys))
}

pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path((channel_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<()>> {
    let message = state
        .db
        .get_message(message_id)
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if message.channel_id != channel_id {
        return Err(AppError::NotFound("Message not found".into()));
    }

    if message.sender_id != auth.member_id {
        let perms = state.db.get_member_permissions(auth.member_id).await?;
        if !permissions::has_permission(perms, permissions::MANAGE_MESSAGES) {
            return Err(AppError::Forbidden);
        }
    }

    state.db.delete_message(message_id).await?;
    Ok(Json(()))
}
