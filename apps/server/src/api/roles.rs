use axum::{
    extract::{Path, State},
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{permissions, Role};
use crate::AppState;

use super::middleware::AuthMember;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_role))
        .route("/", get(get_roles))
        .route("/{id}", patch(update_role))
        .route("/{id}", delete(delete_role))
        .route(
            "/{role_id}/members/{member_id}",
            post(assign_role_to_member),
        )
        .route(
            "/{role_id}/members/{member_id}",
            delete(remove_role_from_member),
        )
}

#[derive(Debug, Serialize)]
pub struct ApiRole {
    pub id: Uuid,
    pub name: String,
    pub permissions: i64,
    pub color: Option<String>,
    pub position: i32,
}

impl From<Role> for ApiRole {
    fn from(role: Role) -> Self {
        Self {
            id: role.id,
            name: role.name,
            permissions: role.permissions,
            color: role.color,
            position: role.position,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub permissions: i64,
    pub color: Option<String>,
    pub position: i32,
}

pub async fn create_role(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Json(req): Json<CreateRoleRequest>,
) -> Result<Json<ApiRole>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::MANAGE_ROLES) {
        return Err(AppError::Forbidden);
    }

    let name_str = req.name.trim().to_string();
    if name_str.is_empty() {
        return Err(AppError::BadRequest("Role name cannot be empty".into()));
    }

    let role = state
        .db
        .create_role(name_str, req.permissions, req.color, req.position)
        .await?;

    Ok(Json(ApiRole::from(role)))
}

pub async fn get_roles(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
) -> Result<Json<Vec<ApiRole>>> {
    let roles = state.db.get_all_roles().await?;
    let api_roles = roles.into_iter().map(ApiRole::from).collect();
    Ok(Json(api_roles))
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub name: Option<String>,
    pub permissions: Option<i64>,
    pub color: Option<String>,
    pub position: Option<i32>,
}

pub async fn update_role(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<ApiRole>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::MANAGE_ROLES) {
        return Err(AppError::Forbidden);
    }

    let name_str = req.name.map(|n| n.trim().to_string());
    if let Some(ref n) = name_str {
        if n.is_empty() {
            return Err(AppError::BadRequest("Role name cannot be empty".into()));
        }
    }

    state
        .db
        .update_role(id, name_str, req.permissions, req.color, req.position)
        .await?;

    let role = state
        .db
        .get_role(id)
        .await?
        .ok_or(AppError::NotFound("Role not found".into()))?;

    Ok(Json(ApiRole::from(role)))
}

pub async fn delete_role(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
) -> Result<Json<()>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::MANAGE_ROLES) {
        return Err(AppError::Forbidden);
    }

    state.db.delete_role(id).await?;
    Ok(Json(()))
}

pub async fn assign_role_to_member(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path((role_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<()>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::MANAGE_ROLES) {
        return Err(AppError::Forbidden);
    }

    let _ = state.db.assign_role(member_id, role_id).await?;
    Ok(Json(()))
}

pub async fn remove_role_from_member(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path((role_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<()>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::MANAGE_ROLES) {
        return Err(AppError::Forbidden);
    }

    state.db.remove_role(member_id, role_id).await?;
    Ok(Json(()))
}
