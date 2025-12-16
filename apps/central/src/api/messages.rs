use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::Utc;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{Message, MessageKey, MessageReaction};
use crate::ws::{
    MessageDeletedData, MessageEditedData, MessagePinnedData, MessageUnpinnedData, NewMessageData,
    ReactionAddedData, ReactionRemovedData, WsMessage,
};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/{conversation_id}", get(get_messages))
        .route("/{conversation_id}", post(send_message))
        .route("/{conversation_id}/{message_id}", put(edit_message))
        .route("/{conversation_id}/{message_id}", delete(delete_message))
        .route("/{conversation_id}/{message_id}/key", get(get_message_key))
        .route(
            "/{conversation_id}/{message_id}/reactions",
            post(add_reaction),
        )
        .route(
            "/{conversation_id}/{message_id}/reactions/{emoji}",
            delete(remove_reaction),
        )
        .route("/{conversation_id}/{message_id}/pin", post(pin_message))
        .route("/{conversation_id}/{message_id}/unpin", post(unpin_message))
        .route("/{conversation_id}/pinned", get(get_pinned_messages))
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub before: Option<Uuid>,
}

fn default_limit() -> i64 {
    50
}

#[derive(Debug, Serialize)]
pub struct MessageWithKey {
    #[serde(flatten)]
    pub message: Message,
    pub encrypted_key: Option<Vec<u8>>,
}

pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
    Query(query): Query<GetMessagesQuery>,
) -> Result<Json<Vec<MessageWithKey>>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let messages = state
        .db
        .get_messages(conversation_id, query.limit.min(100), query.before)
        .await?;

    let message_ids: Vec<Uuid> = messages.iter().map(|m| m.id).collect();
    let keys = state
        .db
        .get_message_keys_for_user(&message_ids, auth.user_id)
        .await?;

    let key_map: HashMap<Uuid, &MessageKey> = keys.iter().map(|k| (k.message_id, k)).collect();

    let messages_with_keys: Vec<MessageWithKey> = messages
        .into_iter()
        .map(|m| {
            let key = key_map.get(&m.id);
            MessageWithKey {
                message: m,
                encrypted_key: key.map(|k| k.encrypted_key.clone()),
            }
        })
        .collect();

    Ok(Json(messages_with_keys))
}

#[derive(Debug, Deserialize)]
pub struct MessageKeyData {
    pub user_id: Uuid,
    pub encrypted_key: Vec<u8>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub sender_chain_id: Option<i32>,
    pub sender_chain_iteration: Option<i32>,
    pub message_keys: Option<Vec<MessageKeyData>>,
}

#[derive(Debug, Serialize)]
pub struct SendMessageResponse {
    pub id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn send_message(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let spam_key = format!("spam:{}:{}", auth.user_id, conversation_id);
    let mut conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let now = Utc::now().timestamp_millis();
    let five_seconds_ago = now - 5000;

    let _: () = conn
        .zadd(&spam_key, now, now)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let _: () = conn
        .zrembyscore(&spam_key, 0, five_seconds_ago)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let count: i64 = conn
        .zcard(&spam_key)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    if count >= 5 {
        let oldest: Option<(String, f64)> = conn
            .zpopmin::<_, Vec<(String, f64)>>(&spam_key, 1)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?
            .into_iter()
            .next();

        if let Some((_, oldest_time)) = oldest {
            let time_since_oldest = now - oldest_time as i64;
            if time_since_oldest < 5000 {
                let _: () = conn
                    .set_ex(format!("{}:cooldown", spam_key), "1", 3)
                    .await
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;
                return Err(AppError::TooManyRequests);
            }
        }
    }

    let cooldown_active: Option<String> = conn
        .get(format!("{}:cooldown", spam_key))
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    if cooldown_active.is_some() {
        return Err(AppError::TooManyRequests);
    }

    let _: () = conn
        .expire(&spam_key, 10)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis error: {}", e)))?;

    let message = state
        .db
        .create_message(
            conversation_id,
            auth.user_id,
            req.encrypted_content.clone(),
            req.signature.clone(),
            req.reply_to_id,
            req.expires_at,
            req.sender_chain_id,
            req.sender_chain_iteration,
        )
        .await?;

    if let Some(keys) = &req.message_keys {
        let key_data: Vec<(Uuid, Vec<u8>)> = keys
            .iter()
            .map(|k| (k.user_id, k.encrypted_key.clone()))
            .collect();
        state.db.store_message_keys(message.id, &key_data).await?;
    }

    let ws_msg = WsMessage::NewMessage(NewMessageData {
        id: message.id,
        conversation_id,
        sender_id: auth.user_id,
        encrypted_content: req.encrypted_content,
        signature: req.signature,
        reply_to_id: req.reply_to_id,
        expires_at: req.expires_at,
        sender_chain_id: req.sender_chain_id,
        sender_chain_iteration: req.sender_chain_iteration,
        message_type: "text".to_string(),
        call_id: None,
        call_duration_seconds: None,
        pinned_at: None,
        created_at: message.created_at,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;

        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                if member.user_id != auth.user_id {
                    let user_channel = format!("user:{}", member.user_id);
                    let _ = publish_to_redis(&state.redis, &user_channel, &json).await;
                }
            }
        }
    }

    Ok(Json(SendMessageResponse {
        id: message.id,
        created_at: message.created_at,
    }))
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Debug, Deserialize)]
pub struct EditMessageRequest {
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub message_keys: Option<Vec<MessageKeyData>>,
}

#[derive(Debug, Serialize)]
pub struct EditMessageResponse {
    pub edited_at: chrono::DateTime<chrono::Utc>,
}

pub async fn edit_message(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<EditMessageRequest>,
) -> Result<Json<EditMessageResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let message = state
        .db
        .get_message(message_id)
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if message.conversation_id != conversation_id {
        return Err(AppError::NotFound("Message not found".into()));
    }

    if message.sender_id != auth.user_id {
        return Err(AppError::Forbidden);
    }

    let edited_at = state
        .db
        .update_message(
            message_id,
            auth.user_id,
            req.encrypted_content.clone(),
            req.signature.clone(),
        )
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if let Some(keys) = &req.message_keys {
        let key_data: Vec<(Uuid, Vec<u8>)> = keys
            .iter()
            .map(|k| (k.user_id, k.encrypted_key.clone()))
            .collect();
        state.db.store_message_keys(message_id, &key_data).await?;
    }

    let ws_msg = WsMessage::MessageEdited(MessageEditedData {
        message_id,
        conversation_id,
        encrypted_content: req.encrypted_content,
        signature: req.signature,
        edited_at,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(EditMessageResponse { edited_at }))
}

pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let deleted = state.db.delete_message(message_id, auth.user_id).await?;

    if !deleted {
        return Err(AppError::NotFound("Message not found".into()));
    }

    let ws_msg = WsMessage::MessageDeleted(MessageDeletedData {
        message_id,
        conversation_id,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(SuccessResponse { success: true }))
}

#[derive(Debug, Serialize)]
pub struct MessageKeyResponse {
    pub encrypted_key: Option<Vec<u8>>,
}

pub async fn get_message_key(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageKeyResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let key = state.db.get_message_key(message_id, auth.user_id).await?;

    Ok(Json(MessageKeyResponse {
        encrypted_key: key.map(|k| k.encrypted_key),
    }))
}

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub emoji: String,
}

pub async fn add_reaction(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<AddReactionRequest>,
) -> Result<Json<MessageReaction>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let message = state
        .db
        .get_message(message_id)
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if message.conversation_id != conversation_id {
        return Err(AppError::NotFound("Message not found".into()));
    }

    let reaction = state
        .db
        .add_reaction(message_id, auth.user_id, &req.emoji)
        .await?;

    let ws_msg = WsMessage::ReactionAdded(ReactionAddedData {
        id: reaction.id,
        message_id,
        conversation_id,
        user_id: auth.user_id,
        emoji: req.emoji,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(reaction))
}

pub async fn remove_reaction(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id, emoji)): Path<(Uuid, Uuid, String)>,
) -> Result<Json<SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let message = state
        .db
        .get_message(message_id)
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if message.conversation_id != conversation_id {
        return Err(AppError::NotFound("Message not found".into()));
    }

    let removed = state
        .db
        .remove_reaction(message_id, auth.user_id, &emoji)
        .await?;

    if !removed {
        return Err(AppError::NotFound("Reaction not found".into()));
    }

    let ws_msg = WsMessage::ReactionRemoved(ReactionRemovedData {
        message_id,
        conversation_id,
        user_id: auth.user_id,
        emoji,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(SuccessResponse { success: true }))
}

pub async fn pin_message(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let message = state
        .db
        .get_message(message_id)
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if message.conversation_id != conversation_id {
        return Err(AppError::NotFound("Message not found".into()));
    }

    if message.sender_id != auth.user_id {
        return Err(AppError::Forbidden);
    }

    let pinned_at = state.db.pin_message(message_id).await?;

    let ws_msg = WsMessage::MessagePinned(MessagePinnedData {
        message_id,
        conversation_id,
        pinner_id: auth.user_id,
        pinned_at,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    // Create system message for pin
    let sys_msg = state
        .db
        .create_system_message(
            conversation_id,
            auth.user_id,
            "channel_pin",
            Some(message_id),
        )
        .await?;

    let sys_ws_msg = WsMessage::NewMessage(NewMessageData {
        id: sys_msg.id,
        conversation_id,
        sender_id: auth.user_id,
        encrypted_content: vec![],
        signature: vec![],
        reply_to_id: Some(message_id),
        expires_at: None,
        sender_chain_id: None,
        sender_chain_iteration: None,
        message_type: "channel_pin".to_string(),
        call_id: None,
        call_duration_seconds: None,
        pinned_at: None,
        created_at: sys_msg.created_at,
    });

    if let Ok(json) = serde_json::to_string(&sys_ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;

        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                if member.user_id != auth.user_id {
                    let user_channel = format!("user:{}", member.user_id);
                    let _ = publish_to_redis(&state.redis, &user_channel, &json).await;
                }
            }
        }
    }

    Ok(Json(SuccessResponse { success: true }))
}

pub async fn unpin_message(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let message = state
        .db
        .get_message(message_id)
        .await?
        .ok_or(AppError::NotFound("Message not found".into()))?;

    if message.conversation_id != conversation_id {
        return Err(AppError::NotFound("Message not found".into()));
    }

    if message.sender_id != auth.user_id {
        return Err(AppError::Forbidden);
    }

    state.db.unpin_message(message_id).await?;

    let ws_msg = WsMessage::MessageUnpinned(MessageUnpinnedData {
        message_id,
        conversation_id,
        unpinner_id: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(SuccessResponse { success: true }))
}

pub async fn get_pinned_messages(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Vec<MessageWithKey>>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let messages = state.db.get_pinned_messages(conversation_id).await?;

    let message_ids: Vec<Uuid> = messages.iter().map(|m| m.id).collect();
    let keys = state
        .db
        .get_message_keys_for_user(&message_ids, auth.user_id)
        .await?;

    let key_map: HashMap<Uuid, &MessageKey> = keys.iter().map(|k| (k.message_id, k)).collect();

    let messages_with_keys: Vec<MessageWithKey> = messages
        .into_iter()
        .map(|m| {
            let key = key_map.get(&m.id);
            MessageWithKey {
                message: m,
                encrypted_key: key.map(|k| k.encrypted_key.clone()),
            }
        })
        .collect();

    Ok(Json(messages_with_keys))
}

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
