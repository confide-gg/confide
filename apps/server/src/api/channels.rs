use axum::{
    extract::{Path, State},
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{permissions, Category, ChannelPermissionOverride, Invite, TextChannel};
use crate::AppState;

use super::middleware::AuthMember;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/categories", post(create_category))
        .route("/categories", get(get_categories))
        .route(
            "/categories/{id}",
            patch(update_category).post(update_category),
        )
        .route("/categories/{id}", delete(delete_category))
        .route("/", post(create_channel))
        .route("/", get(get_channels))
        .route("/{id}", patch(update_channel).post(update_channel))
        .route("/{id}", delete(delete_channel))
        .route("/{id}/keys", post(distribute_channel_keys))
        .route("/{id}/permitted-members", get(get_permitted_members))
        .route("/{id}/permission-overrides", get(get_permission_overrides))
        .route("/{id}/permission-overrides", post(set_permission_override))
        .route(
            "/{id}/permission-overrides",
            delete(delete_permission_override),
        )
        .route("/invites", post(create_invite))
        .route("/invites", get(get_invites))
        .route("/invites/{code}/join", post(join_by_invite))
}

async fn check_permission(state: &AppState, member_id: Uuid, required: i64) -> Result<()> {
    let perms = state.db.get_member_permissions(member_id).await?;
    if !permissions::has_permission(perms, required) {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub position: i32,
}

pub async fn create_category(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Json(req): Json<CreateCategoryRequest>,
) -> Result<Json<Category>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    let category = state.db.create_category(req.name, req.position).await?;
    Ok(Json(category))
}

pub async fn get_categories(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
) -> Result<Json<Vec<Category>>> {
    let categories = state.db.get_all_categories().await?;
    Ok(Json(categories))
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub position: Option<i32>,
}

pub async fn update_category(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCategoryRequest>,
) -> Result<Json<Category>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    state.db.update_category(id, req.name, req.position).await?;
    let category = state
        .db
        .get_category(id)
        .await?
        .ok_or(AppError::NotFound("Category not found".into()))?;
    Ok(Json(category))
}

pub async fn delete_category(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
) -> Result<Json<()>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    state.db.delete_category(id).await?;
    Ok(Json(()))
}

#[derive(Debug, Deserialize)]
pub struct KeyDistribution {
    pub member_id: Uuid,
    pub encrypted_key: Vec<u8>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub category_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub position: i32,
    pub key_distributions: Option<Vec<KeyDistribution>>,
}

pub async fn create_channel(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Json(req): Json<CreateChannelRequest>,
) -> Result<Json<TextChannel>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    let channel = state
        .db
        .create_channel(req.category_id, req.name, req.description, req.position)
        .await?;

    if let Some(distributions) = req.key_distributions {
        let dist_tuples: Vec<(Uuid, Vec<u8>)> = distributions
            .into_iter()
            .map(|d| (d.member_id, d.encrypted_key))
            .collect();
        state
            .db
            .bulk_set_channel_keys(channel.id, dist_tuples, 1)
            .await?;
    }

    Ok(Json(channel))
}

pub async fn get_channels(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
) -> Result<Json<Vec<TextChannel>>> {
    let channels = state.db.get_all_channels().await?;
    Ok(Json(channels))
}

#[derive(Debug, Deserialize)]
pub struct UpdateChannelRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category_id: Option<Option<Uuid>>,
    pub position: Option<i32>,
}

pub async fn update_channel(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateChannelRequest>,
) -> Result<Json<TextChannel>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    state
        .db
        .update_channel(id, req.name, req.description, req.category_id, req.position)
        .await?;
    let channel = state
        .db
        .get_channel(id)
        .await?
        .ok_or(AppError::NotFound("Channel not found".into()))?;
    Ok(Json(channel))
}

pub async fn delete_channel(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
) -> Result<Json<()>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    state.db.delete_channel(id).await?;
    Ok(Json(()))
}

#[derive(Debug, Deserialize)]
pub struct CreateInviteRequest {
    pub max_uses: Option<i32>,
    pub expires_in_seconds: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct InviteResponse {
    pub code: String,
    pub invite: Invite,
}

pub async fn create_invite(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Json(req): Json<CreateInviteRequest>,
) -> Result<Json<InviteResponse>> {
    check_permission(&state, auth.member_id, permissions::CREATE_INVITE).await?;

    let code = nanoid::nanoid!(10);
    let expires_at = req
        .expires_in_seconds
        .map(|s| chrono::Utc::now() + chrono::Duration::seconds(s));

    let invite = state
        .db
        .create_invite(code.clone(), auth.member_id, req.max_uses, expires_at)
        .await?;

    Ok(Json(InviteResponse { code, invite }))
}

pub async fn get_invites(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
) -> Result<Json<Vec<Invite>>> {
    let invites = state.db.get_all_invites().await?;
    Ok(Json(invites))
}

pub async fn join_by_invite(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let invite = state
        .db
        .get_invite_by_code(&code)
        .await?
        .ok_or(AppError::NotFound("Invite not found".into()))?;

    let used = state.db.try_use_invite(invite.id).await?;
    if !used {
        return Err(AppError::BadRequest(
            "Invite is invalid, expired, or has reached max uses".into(),
        ));
    }

    let identity = state
        .db
        .get_server_identity()
        .await?
        .ok_or(AppError::Internal("Server identity not found".into()))?;

    Ok(Json(serde_json::json!({
        "valid": true,
        "server_name": identity.server_name
    })))
}

#[derive(Debug, Deserialize)]
pub struct DistributeKeysRequest {
    pub distributions: Vec<KeyDistribution>,
}

pub async fn distribute_channel_keys(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<DistributeKeysRequest>,
) -> Result<Json<()>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;

    let dist_tuples: Vec<(Uuid, Vec<u8>)> = req
        .distributions
        .into_iter()
        .map(|d| (d.member_id, d.encrypted_key))
        .collect();

    state
        .db
        .bulk_set_channel_keys(channel_id, dist_tuples, 1)
        .await?;
    Ok(Json(()))
}

#[derive(Debug, Serialize)]
pub struct PermittedMember {
    pub id: Uuid,
    pub kem_public_key: Vec<u8>,
}

pub async fn get_permitted_members(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<Vec<PermittedMember>>> {
    let member_ids = state
        .db
        .get_members_with_channel_permission(channel_id, permissions::VIEW_CHANNELS)
        .await?;

    let mut permitted = Vec::new();
    for member_id in member_ids {
        if let Some(member) = state.db.get_member(member_id).await? {
            permitted.push(PermittedMember {
                id: member.id,
                kem_public_key: member.kem_public_key,
            });
        }
    }

    Ok(Json(permitted))
}

pub async fn get_permission_overrides(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<Vec<ChannelPermissionOverride>>> {
    let overrides = state
        .db
        .get_channel_permission_overrides(channel_id)
        .await?;
    Ok(Json(overrides))
}

#[derive(Debug, Deserialize)]
pub struct SetPermissionOverrideRequest {
    pub role_id: Option<Uuid>,
    pub member_id: Option<Uuid>,
    pub allow_permissions: i64,
    pub deny_permissions: i64,
}

pub async fn set_permission_override(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<SetPermissionOverrideRequest>,
) -> Result<Json<ChannelPermissionOverride>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;

    if req.role_id.is_none() && req.member_id.is_none() {
        return Err(AppError::BadRequest(
            "Either role_id or member_id must be provided".into(),
        ));
    }
    if req.role_id.is_some() && req.member_id.is_some() {
        return Err(AppError::BadRequest(
            "Cannot specify both role_id and member_id".into(),
        ));
    }

    let override_record = state
        .db
        .set_channel_permission_override(
            channel_id,
            req.role_id,
            req.member_id,
            req.allow_permissions,
            req.deny_permissions,
        )
        .await?;

    Ok(Json(override_record))
}

#[derive(Debug, Deserialize)]
pub struct DeletePermissionOverrideRequest {
    pub role_id: Option<Uuid>,
    pub member_id: Option<Uuid>,
}

pub async fn delete_permission_override(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(channel_id): Path<Uuid>,
    Json(req): Json<DeletePermissionOverrideRequest>,
) -> Result<Json<()>> {
    check_permission(&state, auth.member_id, permissions::MANAGE_CHANNELS).await?;
    state
        .db
        .delete_channel_permission_override(channel_id, req.role_id, req.member_id)
        .await?;
    Ok(Json(()))
}
