use axum::{
    extract::{Path, State},
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{ConversationType, ConversationWithRouting, PublicUser};
use crate::ws::NewMessageData;
use crate::ws::{
    GroupCreatedData, GroupDeletedData, GroupMemberAddedData, GroupMemberLeftData,
    GroupMemberRemovedData, GroupMetadataUpdatedData, GroupOwnerChangedData, WsMessage,
};
use crate::AppState;

use super::middleware::AuthUser;
use rand::seq::SliceRandom;
use rand::thread_rng;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_conversations))
        .route("/", post(create_conversation))
        .route("/groups", post(create_group))
        .route("/dm/{user_id}", post(get_or_create_dm))
        .route("/{id}/members", get(get_members))
        .route("/{id}/members", post(add_member))
        .route("/{id}/members/bulk", post(add_members_bulk))
        .route("/{id}/members/{user_id}", delete(remove_member))
        .route("/{id}/leave", post(leave_group))
        .route("/{id}/hide", post(hide_conversation))
        .route("/{id}/owner", put(update_owner))
        .route("/{id}/metadata", patch(update_metadata))
        .route("/{id}", delete(delete_conversation))
}

pub async fn get_conversations(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Vec<ConversationWithRouting>>> {
    let conversations = state.db.get_user_conversations(auth.user_id).await?;
    Ok(Json(conversations))
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub conversation_type: ConversationType,
    pub encrypted_metadata: Option<Vec<u8>>,
    pub members: Vec<MemberInit>,
}

#[derive(Debug, Deserialize)]
pub struct MemberInit {
    pub user_id: Uuid,
    pub encrypted_sender_key: Vec<u8>,
    pub encrypted_role: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct ConversationResponse {
    pub id: Uuid,
    pub conversation_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encrypted_sender_key: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encrypted_role: Option<Vec<u8>>,
}

pub async fn create_conversation(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<CreateConversationRequest>,
) -> Result<Json<ConversationResponse>> {
    let has_self = req.members.iter().any(|m| m.user_id == auth.user_id);
    if !has_self {
        return Err(AppError::BadRequest(
            "must include yourself as a member".into(),
        ));
    }

    let owner_id = match req.conversation_type {
        ConversationType::Group => Some(auth.user_id),
        _ => None,
    };

    let conversation = state
        .db
        .create_conversation(req.conversation_type, req.encrypted_metadata, owner_id)
        .await?;

    for member in req.members {
        state
            .db
            .add_conversation_member(
                conversation.id,
                member.user_id,
                member.encrypted_sender_key,
                member.encrypted_role,
            )
            .await?;
    }

    if matches!(req.conversation_type, ConversationType::Group) {
        let _ = state
            .db
            .add_group_event(conversation.id, "group_created", Some(auth.user_id), None)
            .await;
    }

    Ok(Json(ConversationResponse {
        id: conversation.id,
        conversation_type: conversation.conversation_type,
        encrypted_sender_key: None,
        encrypted_role: None,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    pub encrypted_metadata: Option<Vec<u8>>,
    pub members: Vec<MemberInit>,
}

pub async fn create_group(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<CreateGroupRequest>,
) -> Result<Json<ConversationResponse>> {
    let mut unique = std::collections::HashSet::new();
    for m in &req.members {
        if !unique.insert(m.user_id) {
            return Err(AppError::BadRequest("duplicate member".into()));
        }
    }

    let has_self = req.members.iter().any(|m| m.user_id == auth.user_id);
    if !has_self {
        return Err(AppError::BadRequest(
            "must include yourself as a member".into(),
        ));
    }
    if req.members.len() < 2 {
        return Err(AppError::BadRequest(
            "group must have at least 2 members".into(),
        ));
    }
    if req.members.len() > 10 {
        return Err(AppError::BadRequest("group limit is 10 members".into()));
    }

    let user_ids: Vec<Uuid> = req.members.iter().map(|m| m.user_id).collect();
    let found_users = state.db.get_users_by_ids(&user_ids).await?;
    if found_users.len() != user_ids.len() {
        return Err(AppError::UserNotFound);
    }

    let conversation = state
        .db
        .create_conversation(
            ConversationType::Group,
            req.encrypted_metadata,
            Some(auth.user_id),
        )
        .await?;

    let added_user_ids: Vec<Uuid> = req
        .members
        .iter()
        .map(|m| m.user_id)
        .filter(|id| *id != auth.user_id)
        .collect();

    for member in req.members {
        state
            .db
            .add_conversation_member(
                conversation.id,
                member.user_id,
                member.encrypted_sender_key,
                member.encrypted_role,
            )
            .await?;
    }

    let _ = state
        .db
        .add_group_event(conversation.id, "group_created", Some(auth.user_id), None)
        .await;

    let msg = WsMessage::GroupCreated(GroupCreatedData {
        conversation_id: conversation.id,
        owner_id: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        if let Ok(members) = state.db.get_conversation_members(conversation.id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    if !added_user_ids.is_empty() {
        let payload = serde_json::json!({ "added_user_ids": added_user_ids }).to_string();
        let sys = state
            .db
            .create_system_message_with_content(
                conversation.id,
                auth.user_id,
                "group_member_added",
                payload.into_bytes(),
            )
            .await?;

        let sys_ws = WsMessage::NewMessage(NewMessageData {
            id: sys.id,
            conversation_id: sys.conversation_id,
            sender_id: sys.sender_id,
            encrypted_content: sys.encrypted_content.clone(),
            signature: sys.signature.clone(),
            reply_to_id: sys.reply_to_id,
            expires_at: sys.expires_at,
            sender_chain_id: sys.sender_chain_id,
            sender_chain_iteration: sys.sender_chain_iteration,
            message_type: sys.message_type.clone(),
            call_id: sys.call_id,
            call_duration_seconds: sys.call_duration_seconds,
            pinned_at: sys.pinned_at,
            created_at: sys.created_at,
        });

        if let Ok(json) = serde_json::to_string(&sys_ws) {
            if let Ok(members) = state.db.get_conversation_members(conversation.id).await {
                for member in members {
                    let channel = format!("user:{}", member.user_id);
                    let _ = publish_to_redis(&state.redis, &channel, &json).await;
                }
            }
        }
    }

    Ok(Json(ConversationResponse {
        id: conversation.id,
        conversation_type: conversation.conversation_type,
        encrypted_sender_key: None,
        encrypted_role: None,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateDmRequest {
    pub my_encrypted_sender_key: Vec<u8>,
    pub my_encrypted_role: Vec<u8>,
    pub their_encrypted_sender_key: Vec<u8>,
    pub their_encrypted_role: Vec<u8>,
    pub encrypted_metadata: Option<Vec<u8>>,
}

pub async fn get_or_create_dm(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(other_user_id): Path<Uuid>,
    Json(req): Json<CreateDmRequest>,
) -> Result<Json<ConversationResponse>> {
    if other_user_id == auth.user_id {
        return Err(AppError::BadRequest(
            "cannot create DM with yourself".into(),
        ));
    }

    state
        .db
        .get_user_by_id(other_user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if let Some(existing) = state
        .db
        .find_dm_conversation(auth.user_id, other_user_id)
        .await?
    {
        let _ = state
            .db
            .unhide_conversation(existing.id, auth.user_id)
            .await;

        let routing = state
            .db
            .get_conversation_routing(existing.id, auth.user_id)
            .await?
            .ok_or(AppError::NotConversationMember)?;

        return Ok(Json(ConversationResponse {
            id: existing.id,
            conversation_type: existing.conversation_type,
            encrypted_sender_key: Some(routing.encrypted_sender_key),
            encrypted_role: Some(routing.encrypted_role),
        }));
    }

    let conversation = state
        .db
        .create_conversation(ConversationType::Dm, req.encrypted_metadata, None)
        .await?;

    let my_sender_key = req.my_encrypted_sender_key.clone();
    let my_role = req.my_encrypted_role.clone();

    state
        .db
        .add_conversation_member(
            conversation.id,
            auth.user_id,
            req.my_encrypted_sender_key,
            req.my_encrypted_role,
        )
        .await?;

    state
        .db
        .add_conversation_member(
            conversation.id,
            other_user_id,
            req.their_encrypted_sender_key,
            req.their_encrypted_role,
        )
        .await?;

    Ok(Json(ConversationResponse {
        id: conversation.id,
        conversation_type: conversation.conversation_type,
        encrypted_sender_key: Some(my_sender_key),
        encrypted_role: Some(my_role),
    }))
}

#[derive(Debug, Serialize)]
pub struct MemberResponse {
    pub user: PublicUser,
    pub encrypted_role: Vec<u8>,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_members(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Vec<MemberResponse>>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let members = state
        .db
        .get_conversation_members_with_users(conversation_id)
        .await?;

    let responses = members
        .into_iter()
        .map(|member| MemberResponse {
            user: PublicUser {
                id: member.user_id,
                username: member.username,
                kem_public_key: member.kem_public_key,
                dsa_public_key: member.dsa_public_key,
            },
            encrypted_role: member.encrypted_role,
            joined_at: member.joined_at,
        })
        .collect();

    Ok(Json(responses))
}

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub encrypted_sender_key: Vec<u8>,
    pub encrypted_role: Vec<u8>,
}

pub async fn add_member(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<AddMemberRequest>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }
    if conv.owner_id != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    state
        .db
        .get_user_by_id(req.user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    state
        .db
        .add_conversation_member(
            conversation_id,
            req.user_id,
            req.encrypted_sender_key,
            req.encrypted_role,
        )
        .await?;

    let _ = state
        .db
        .add_group_event(
            conversation_id,
            "member_added",
            Some(auth.user_id),
            Some(req.user_id),
        )
        .await;

    let msg = WsMessage::GroupMemberAdded(GroupMemberAddedData {
        conversation_id,
        user_id: req.user_id,
        added_by: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    let payload = serde_json::json!({ "added_user_ids": [req.user_id] }).to_string();
    let sys = state
        .db
        .create_system_message_with_content(
            conversation_id,
            auth.user_id,
            "group_member_added",
            payload.into_bytes(),
        )
        .await?;

    let sys_ws = WsMessage::NewMessage(NewMessageData {
        id: sys.id,
        conversation_id: sys.conversation_id,
        sender_id: sys.sender_id,
        encrypted_content: sys.encrypted_content.clone(),
        signature: sys.signature.clone(),
        reply_to_id: sys.reply_to_id,
        expires_at: sys.expires_at,
        sender_chain_id: sys.sender_chain_id,
        sender_chain_iteration: sys.sender_chain_iteration,
        message_type: sys.message_type.clone(),
        call_id: sys.call_id,
        call_duration_seconds: sys.call_duration_seconds,
        pinned_at: sys.pinned_at,
        created_at: sys.created_at,
    });
    if let Ok(json) = serde_json::to_string(&sys_ws) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

#[derive(Debug, Deserialize)]
pub struct AddMembersBulkRequest {
    pub members: Vec<AddMemberRequest>,
}

pub async fn add_members_bulk(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<AddMembersBulkRequest>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }
    if conv.owner_id != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    if req.members.is_empty() {
        return Err(AppError::BadRequest("no members provided".into()));
    }

    let mut unique = std::collections::HashSet::new();
    for m in &req.members {
        if !unique.insert(m.user_id) {
            return Err(AppError::BadRequest("duplicate member".into()));
        }
    }

    let existing = state.db.get_conversation_members(conversation_id).await?;
    let existing_ids: std::collections::HashSet<Uuid> =
        existing.iter().map(|m| m.user_id).collect();

    let remaining = 10usize.saturating_sub(existing_ids.len());
    if req.members.len() > remaining {
        return Err(AppError::BadRequest("group limit is 10 members".into()));
    }

    let new_members: Vec<_> = req
        .members
        .into_iter()
        .filter(|m| !existing_ids.contains(&m.user_id))
        .collect();

    if new_members.is_empty() {
        return Ok(Json(super::messages::SuccessResponse { success: true }));
    }

    let user_ids: Vec<Uuid> = new_members.iter().map(|m| m.user_id).collect();
    let found_users = state.db.get_users_by_ids(&user_ids).await?;
    if found_users.len() != user_ids.len() {
        return Err(AppError::UserNotFound);
    }

    let mut added_ids: Vec<Uuid> = Vec::new();
    for m in new_members {
        state
            .db
            .add_conversation_member(
                conversation_id,
                m.user_id,
                m.encrypted_sender_key,
                m.encrypted_role,
            )
            .await?;

        if let Err(e) = state
            .db
            .add_group_event(
                conversation_id,
                "member_added",
                Some(auth.user_id),
                Some(m.user_id),
            )
            .await
        {
            tracing::error!("Failed to add group event: {:?}", e);
        }

        let msg = WsMessage::GroupMemberAdded(GroupMemberAddedData {
            conversation_id,
            user_id: m.user_id,
            added_by: auth.user_id,
        });
        if let Ok(json) = serde_json::to_string(&msg) {
            for member_id in &existing_ids {
                let channel = format!("user:{}", member_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
            let channel = format!("user:{}", m.user_id);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }

        added_ids.push(m.user_id);
    }

    if !added_ids.is_empty() {
        let payload = serde_json::json!({ "added_user_ids": added_ids }).to_string();
        let sys = state
            .db
            .create_system_message_with_content(
                conversation_id,
                auth.user_id,
                "group_member_added",
                payload.into_bytes(),
            )
            .await?;

        let sys_ws = WsMessage::NewMessage(NewMessageData {
            id: sys.id,
            conversation_id: sys.conversation_id,
            sender_id: sys.sender_id,
            encrypted_content: sys.encrypted_content.clone(),
            signature: sys.signature.clone(),
            reply_to_id: sys.reply_to_id,
            expires_at: sys.expires_at,
            sender_chain_id: sys.sender_chain_id,
            sender_chain_iteration: sys.sender_chain_iteration,
            message_type: sys.message_type.clone(),
            call_id: sys.call_id,
            call_duration_seconds: sys.call_duration_seconds,
            pinned_at: sys.pinned_at,
            created_at: sys.created_at,
        });

        if let Ok(json) = serde_json::to_string(&sys_ws) {
            for member_id in &existing_ids {
                let channel = format!("user:{}", member_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
            for added_id in &added_ids {
                let channel = format!("user:{}", added_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

pub async fn remove_member(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path((conversation_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }
    if conv.owner_id != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }
    if user_id == auth.user_id {
        return Err(AppError::BadRequest("use leave endpoint to leave".into()));
    }

    state
        .db
        .get_conversation_routing(conversation_id, user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let members_before = state.db.get_conversation_members(conversation_id).await?;
    state
        .db
        .remove_conversation_member(conversation_id, user_id)
        .await?;

    let _ = state
        .db
        .add_group_event(
            conversation_id,
            "member_removed",
            Some(auth.user_id),
            Some(user_id),
        )
        .await;

    let msg = WsMessage::GroupMemberRemoved(GroupMemberRemovedData {
        conversation_id,
        user_id,
        removed_by: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
        let channel = format!("user:{}", user_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    let payload = serde_json::json!({ "removed_user_id": user_id }).to_string();
    let sys = state
        .db
        .create_system_message_with_content(
            conversation_id,
            auth.user_id,
            "group_member_removed",
            payload.into_bytes(),
        )
        .await?;

    let sys_ws = WsMessage::NewMessage(NewMessageData {
        id: sys.id,
        conversation_id: sys.conversation_id,
        sender_id: sys.sender_id,
        encrypted_content: sys.encrypted_content.clone(),
        signature: sys.signature.clone(),
        reply_to_id: sys.reply_to_id,
        expires_at: sys.expires_at,
        sender_chain_id: sys.sender_chain_id,
        sender_chain_iteration: sys.sender_chain_iteration,
        message_type: sys.message_type.clone(),
        call_id: sys.call_id,
        call_duration_seconds: sys.call_duration_seconds,
        pinned_at: sys.pinned_at,
        created_at: sys.created_at,
    });
    if let Ok(json) = serde_json::to_string(&sys_ws) {
        for member in members_before {
            let channel = format!("user:{}", member.user_id);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }
    }

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

pub async fn leave_group(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }

    if conv.owner_id == Some(auth.user_id) {
        let mut members = state.db.get_conversation_members(conversation_id).await?;
        members.retain(|m| m.user_id != auth.user_id);
        if members.is_empty() {
            let msg = WsMessage::GroupDeleted(GroupDeletedData {
                conversation_id,
                deleted_by: auth.user_id,
            });
            if let Ok(json) = serde_json::to_string(&msg) {
                let channel = format!("user:{}", auth.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
            state.db.delete_conversation(conversation_id).await?;
            let _ = state
                .db
                .add_group_event(conversation_id, "group_deleted", Some(auth.user_id), None)
                .await;
            return Ok(Json(super::messages::SuccessResponse { success: true }));
        }
        let new_owner = {
            let mut rng = thread_rng();
            members.choose(&mut rng).map(|m| m.user_id)
        }
        .ok_or(AppError::Internal(anyhow::anyhow!("No members available")))?;
        state
            .db
            .update_conversation_owner(conversation_id, Some(new_owner))
            .await?;
        let _ = state
            .db
            .add_group_event(
                conversation_id,
                "owner_changed",
                Some(auth.user_id),
                Some(new_owner),
            )
            .await;

        let msg = WsMessage::GroupOwnerChanged(GroupOwnerChangedData {
            conversation_id,
            old_owner_id: auth.user_id,
            new_owner_id: new_owner,
            changed_by: auth.user_id,
        });
        if let Ok(json) = serde_json::to_string(&msg) {
            if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
                for member in members {
                    let channel = format!("user:{}", member.user_id);
                    let _ = publish_to_redis(&state.redis, &channel, &json).await;
                }
            }
        }

        let payload =
            serde_json::json!({ "old_owner_id": auth.user_id, "new_owner_id": new_owner })
                .to_string();
        let sys = state
            .db
            .create_system_message_with_content(
                conversation_id,
                auth.user_id,
                "group_owner_changed",
                payload.into_bytes(),
            )
            .await?;
        let sys_ws = WsMessage::NewMessage(NewMessageData {
            id: sys.id,
            conversation_id: sys.conversation_id,
            sender_id: sys.sender_id,
            encrypted_content: sys.encrypted_content.clone(),
            signature: sys.signature.clone(),
            reply_to_id: sys.reply_to_id,
            expires_at: sys.expires_at,
            sender_chain_id: sys.sender_chain_id,
            sender_chain_iteration: sys.sender_chain_iteration,
            message_type: sys.message_type.clone(),
            call_id: sys.call_id,
            call_duration_seconds: sys.call_duration_seconds,
            pinned_at: sys.pinned_at,
            created_at: sys.created_at,
        });
        if let Ok(json) = serde_json::to_string(&sys_ws) {
            if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
                for member in members {
                    let channel = format!("user:{}", member.user_id);
                    let _ = publish_to_redis(&state.redis, &channel, &json).await;
                }
            }
        }
    }

    let payload = serde_json::json!({ "user_id": auth.user_id }).to_string();
    let sys = state
        .db
        .create_system_message_with_content(
            conversation_id,
            auth.user_id,
            "group_member_left",
            payload.into_bytes(),
        )
        .await?;
    let sys_ws = WsMessage::NewMessage(NewMessageData {
        id: sys.id,
        conversation_id: sys.conversation_id,
        sender_id: sys.sender_id,
        encrypted_content: sys.encrypted_content.clone(),
        signature: sys.signature.clone(),
        reply_to_id: sys.reply_to_id,
        expires_at: sys.expires_at,
        sender_chain_id: sys.sender_chain_id,
        sender_chain_iteration: sys.sender_chain_iteration,
        message_type: sys.message_type.clone(),
        call_id: sys.call_id,
        call_duration_seconds: sys.call_duration_seconds,
        pinned_at: sys.pinned_at,
        created_at: sys.created_at,
    });
    if let Ok(json) = serde_json::to_string(&sys_ws) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
        let channel = format!("user:{}", auth.user_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    state
        .db
        .remove_conversation_member(conversation_id, auth.user_id)
        .await?;

    let _ = state
        .db
        .add_group_event(
            conversation_id,
            "member_left",
            Some(auth.user_id),
            Some(auth.user_id),
        )
        .await;

    let msg = WsMessage::GroupMemberLeft(GroupMemberLeftData {
        conversation_id,
        user_id: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        let mut targets = vec![auth.user_id];
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                targets.push(member.user_id);
            }
        }
        targets.sort();
        targets.dedup();
        for uid in targets {
            let channel = format!("user:{}", uid);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }
    }

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateOwnerRequest {
    pub new_owner_id: Uuid,
}

pub async fn update_owner(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<UpdateOwnerRequest>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }
    if conv.owner_id != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    state
        .db
        .get_conversation_routing(conversation_id, req.new_owner_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    state
        .db
        .update_conversation_owner(conversation_id, Some(req.new_owner_id))
        .await?;

    let _ = state
        .db
        .add_group_event(
            conversation_id,
            "owner_changed",
            Some(auth.user_id),
            Some(req.new_owner_id),
        )
        .await;

    let msg = WsMessage::GroupOwnerChanged(GroupOwnerChangedData {
        conversation_id,
        old_owner_id: auth.user_id,
        new_owner_id: req.new_owner_id,
        changed_by: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    let payload =
        serde_json::json!({ "old_owner_id": auth.user_id, "new_owner_id": req.new_owner_id })
            .to_string();
    let sys = state
        .db
        .create_system_message_with_content(
            conversation_id,
            auth.user_id,
            "group_owner_changed",
            payload.into_bytes(),
        )
        .await?;
    let sys_ws = WsMessage::NewMessage(NewMessageData {
        id: sys.id,
        conversation_id: sys.conversation_id,
        sender_id: sys.sender_id,
        encrypted_content: sys.encrypted_content.clone(),
        signature: sys.signature.clone(),
        reply_to_id: sys.reply_to_id,
        expires_at: sys.expires_at,
        sender_chain_id: sys.sender_chain_id,
        sender_chain_iteration: sys.sender_chain_iteration,
        message_type: sys.message_type.clone(),
        call_id: sys.call_id,
        call_duration_seconds: sys.call_duration_seconds,
        pinned_at: sys.pinned_at,
        created_at: sys.created_at,
    });
    if let Ok(json) = serde_json::to_string(&sys_ws) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateMetadataRequest {
    pub encrypted_metadata: Option<Vec<u8>>,
}

pub async fn update_metadata(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<UpdateMetadataRequest>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }
    if conv.owner_id != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    state
        .db
        .update_conversation_metadata(conversation_id, req.encrypted_metadata)
        .await?;

    let _ = state
        .db
        .add_group_event(
            conversation_id,
            "metadata_updated",
            Some(auth.user_id),
            None,
        )
        .await;

    let msg = WsMessage::GroupMetadataUpdated(GroupMetadataUpdatedData {
        conversation_id,
        updated_by: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                let channel = format!("user:{}", member.user_id);
                let _ = publish_to_redis(&state.redis, &channel, &json).await;
            }
        }
    }

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

pub async fn hide_conversation(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    state
        .db
        .hide_conversation(conversation_id, auth.user_id)
        .await?;

    Ok(Json(super::messages::SuccessResponse { success: true }))
}

pub async fn delete_conversation(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<super::messages::SuccessResponse>> {
    state
        .db
        .get_conversation_routing(conversation_id, auth.user_id)
        .await?
        .ok_or(AppError::NotConversationMember)?;

    let conv = state
        .db
        .get_conversation(conversation_id)
        .await?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;

    if conv.conversation_type != ConversationType::Group.as_str() {
        return Err(AppError::BadRequest("not a group conversation".into()));
    }
    if conv.owner_id != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    let members = state.db.get_conversation_members(conversation_id).await?;
    let msg = WsMessage::GroupDeleted(GroupDeletedData {
        conversation_id,
        deleted_by: auth.user_id,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        for member in &members {
            let channel = format!("user:{}", member.user_id);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }
    }

    state.db.delete_conversation(conversation_id).await?;

    let _ = state
        .db
        .add_group_event(conversation_id, "group_deleted", Some(auth.user_id), None)
        .await;

    Ok(Json(super::messages::SuccessResponse { success: true }))
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
