use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{permissions, Ban, Member};
use crate::AppState;

use super::middleware::AuthMember;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_members))
        .route("/me", get(get_me))
        .route("/me/permissions", get(get_my_permissions))
        .route("/me/leave", post(leave_server))
        .route("/roles", get(get_all_member_roles))
        .route("/{id}", get(get_member))
        .route("/{id}/roles", get(get_member_roles))
        .route("/{id}/kick", post(kick_member))
        .route("/{id}/ban", post(ban_member))
        .route("/{id}/unban", post(unban_member))
        .route("/bans", get(get_bans))
}

pub async fn get_members(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
) -> Result<Json<Vec<Member>>> {
    let members = state.db.get_all_members().await?;
    Ok(Json(members))
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    #[serde(flatten)]
    pub member: Member,
    pub channel_keys: std::collections::HashMap<String, Vec<u8>>,
}

pub async fn get_me(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<MeResponse>> {
    let member = state
        .db
        .get_member(auth.member_id)
        .await?
        .ok_or(AppError::NotFound("Member not found".into()))?;

    let keys = state.db.get_member_channel_keys(auth.member_id).await?;
    let channel_keys: std::collections::HashMap<String, Vec<u8>> = keys
        .into_iter()
        .map(|k| (k.channel_id.to_string(), k.encrypted_key))
        .collect();

    Ok(Json(MeResponse {
        member,
        channel_keys,
    }))
}

#[derive(Debug, Serialize)]
pub struct PermissionsResponse {
    pub permissions: i64,
}

pub async fn get_my_permissions(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<PermissionsResponse>> {
    let permissions = state.db.get_member_permissions(auth.member_id).await?;
    Ok(Json(PermissionsResponse { permissions }))
}

#[derive(Debug, Serialize)]
pub struct MemberRolesResponse {
    pub member_id: Uuid,
    pub role_ids: Vec<Uuid>,
}

pub async fn get_member_roles(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Uuid>>> {
    let role_ids = state.db.get_member_role_ids(id).await?;
    Ok(Json(role_ids))
}

pub async fn get_all_member_roles(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
) -> Result<Json<Vec<MemberRolesResponse>>> {
    let members_with_roles = state.db.get_all_members_with_roles().await?;

    let result = members_with_roles
        .into_iter()
        .map(|(member, role_ids)| MemberRolesResponse {
            member_id: member.id,
            role_ids,
        })
        .collect();

    Ok(Json(result))
}

pub async fn leave_server(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<serde_json::Value>> {
    let member = state
        .db
        .get_member(auth.member_id)
        .await?
        .ok_or(AppError::NotFound("Member not found".into()))?;

    let identity = state.db.get_server_identity().await?;
    if let Some(id) = identity {
        if let Some(owner_id) = id.owner_user_id {
            if member.central_user_id == owner_id {
                return Err(AppError::BadRequest(
                    "Server owner cannot leave. Transfer ownership or delete the server.".into(),
                ));
            }
        }
    }

    state.db.delete_member(auth.member_id).await?;
    state.db.delete_member_sessions(auth.member_id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn get_member(
    State(state): State<Arc<AppState>>,
    _auth: AuthMember,
    Path(id): Path<Uuid>,
) -> Result<Json<Member>> {
    let member = state
        .db
        .get_member(id)
        .await?
        .ok_or(AppError::NotFound("Member not found".into()))?;
    Ok(Json(member))
}

pub async fn kick_member(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
) -> Result<Json<()>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::KICK_MEMBERS) {
        return Err(AppError::Forbidden);
    }

    if id == auth.member_id {
        return Err(AppError::BadRequest("Cannot kick yourself".into()));
    }

    let identity = state.db.get_server_identity().await?;
    if let Some(id_inner) = identity {
        if let Some(owner_id) = id_inner.owner_user_id {
            let member = state.db.get_member(id).await?;
            if let Some(m) = member {
                if m.central_user_id == owner_id {
                    return Err(AppError::BadRequest("Cannot kick the owner".into()));
                }
            }
        }
    }

    state.db.delete_member(id).await?;
    Ok(Json(()))
}

#[derive(Debug, Deserialize)]
pub struct BanRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BanResponse {
    pub ban: Ban,
}

pub async fn ban_member(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(id): Path<Uuid>,
    Json(req): Json<BanRequest>,
) -> Result<Json<BanResponse>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::BAN_MEMBERS) {
        return Err(AppError::Forbidden);
    }

    if id == auth.member_id {
        return Err(AppError::BadRequest("Cannot ban yourself".into()));
    }

    let member = state
        .db
        .get_member(id)
        .await?
        .ok_or(AppError::NotFound("Member not found".into()))?;

    let identity = state.db.get_server_identity().await?;
    if let Some(id_inner) = identity {
        if let Some(owner_id) = id_inner.owner_user_id {
            if member.central_user_id == owner_id {
                return Err(AppError::BadRequest("Cannot ban the owner".into()));
            }
        }
    }

    let ban = state
        .db
        .ban_user(member.central_user_id, auth.member_id, req.reason)
        .await?;

    state.db.delete_member(id).await?;

    Ok(Json(BanResponse { ban }))
}

pub async fn unban_member(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Path(central_user_id): Path<Uuid>,
) -> Result<Json<()>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::BAN_MEMBERS) {
        return Err(AppError::Forbidden);
    }

    state.db.unban_user(central_user_id).await?;
    Ok(Json(()))
}

pub async fn get_bans(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<Vec<Ban>>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::BAN_MEMBERS) {
        return Err(AppError::Forbidden);
    }

    let bans = state.db.get_all_bans().await?;
    Ok(Json(bans))
}
