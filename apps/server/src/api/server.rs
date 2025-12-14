use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::{AppError, Result};
use crate::models::permissions;
use crate::AppState;

use super::middleware::AuthMember;

use axum::routing::delete;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/password", post(set_password))
        .route("/password/remove", post(remove_password))
        .route("/info", get(get_server_info))
        .route("/", delete(delete_server))
}

#[derive(Debug, Serialize)]
pub struct ServerInfoResponse {
    pub name: String,
    pub has_password: bool,
}

pub async fn get_server_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ServerInfoResponse>> {
    let identity = state
        .db
        .get_server_identity()
        .await?
        .ok_or(AppError::ServerNotSetup)?;

    Ok(Json(ServerInfoResponse {
        name: identity.server_name,
        has_password: identity.password_hash.is_some(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct SetPasswordRequest {
    pub password: String,
}

pub async fn set_password(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
    Json(req): Json<SetPasswordRequest>,
) -> Result<Json<serde_json::Value>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::ADMINISTRATOR) {
        let identity = state.db.get_server_identity().await?;
        let is_owner = identity
            .and_then(|i| i.owner_user_id)
            .map(|owner_id| {
                let member = futures::executor::block_on(state.db.get_member(auth.member_id));
                member
                    .ok()
                    .flatten()
                    .map(|m| m.central_user_id == owner_id)
                    .unwrap_or(false)
            })
            .unwrap_or(false);

        if !is_owner {
            return Err(AppError::Forbidden);
        }
    }

    if req.password.len() < 4 {
        return Err(AppError::BadRequest(
            "Password must be at least 4 characters".into(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?
        .to_string();

    state.db.set_server_password(Some(password_hash)).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn remove_password(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<serde_json::Value>> {
    let perms = state.db.get_member_permissions(auth.member_id).await?;
    if !permissions::has_permission(perms, permissions::ADMINISTRATOR) {
        let identity = state.db.get_server_identity().await?;
        let is_owner = identity
            .and_then(|i| i.owner_user_id)
            .map(|owner_id| {
                let member = futures::executor::block_on(state.db.get_member(auth.member_id));
                member
                    .ok()
                    .flatten()
                    .map(|m| m.central_user_id == owner_id)
                    .unwrap_or(false)
            })
            .unwrap_or(false);

        if !is_owner {
            return Err(AppError::Forbidden);
        }
    }

    state.db.set_server_password(None).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

pub async fn delete_server(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<serde_json::Value>> {
    let member = state
        .db
        .get_member(auth.member_id)
        .await?
        .ok_or(AppError::NotFound("Member not found".into()))?;

    let identity = state
        .db
        .get_server_identity()
        .await?
        .ok_or(AppError::ServerNotSetup)?;

    let is_owner = identity
        .owner_user_id
        .map(|owner_id| member.central_user_id == owner_id)
        .unwrap_or(false);

    if !is_owner {
        return Err(AppError::Forbidden);
    }

    state.db.delete_all_data().await?;

    Ok(Json(
        serde_json::json!({ "success": true, "deleted": true }),
    ))
}
