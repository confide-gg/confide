use axum::{
    extract::{Path, State},
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{permissions, Category, Invite, TextChannel};
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
pub struct CreateChannelRequest {
    pub category_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub position: i32,
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
