use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{ConversationType, ConversationWithRouting, PublicUser};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_conversations))
        .route("/", post(create_conversation))
        .route("/dm/{user_id}", post(get_or_create_dm))
        .route("/{id}/members", get(get_members))
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

    let conversation = state
        .db
        .create_conversation(req.conversation_type, req.encrypted_metadata)
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

    Ok(Json(ConversationResponse {
        id: conversation.id,
        conversation_type: conversation.conversation_type,
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
        return Ok(Json(ConversationResponse {
            id: existing.id,
            conversation_type: existing.conversation_type,
        }));
    }

    let conversation = state
        .db
        .create_conversation(ConversationType::Dm, req.encrypted_metadata)
        .await?;

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
