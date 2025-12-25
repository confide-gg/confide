use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::federation::verify_federation_token;
use crate::ws::types::ServerMessage;
use crate::AppState;

use super::middleware::AuthMember;
use super::server::verify_password;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/login", post(federated_login))
        .route("/logout", post(logout))
}

#[derive(Debug, Deserialize)]
pub struct FederatedLoginRequest {
    pub federation_token: String,
    pub user_id: Uuid,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub member_id: Uuid,
    pub session_token: String,
    pub is_new_member: bool,
}

pub async fn federated_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<FederatedLoginRequest>,
) -> Result<Json<LoginResponse>> {
    if !state.db.is_setup_complete().await? {
        return Err(AppError::ServerNotSetup);
    }

    let identity = state
        .db
        .get_server_identity()
        .await?
        .ok_or(AppError::ServerNotSetup)?;

    let server_id = identity.central_registration_id.unwrap_or(identity.id);

    let user_info = verify_federation_token(
        &state.http_client,
        server_id,
        &req.federation_token, // This should be req.token based on the instruction, but the instruction snippet shows req.token. I will use req.federation_token as it's in the struct.
        req.user_id,
        &state.config.server.central_url,
    )
    .await
    .map_err(AppError::Federation)?
    .ok_or(AppError::Unauthorized)?;

    if state.db.is_banned(user_info.user_id).await? {
        return Err(AppError::Forbidden);
    }

    let (member, is_new) = match state.db.get_member_by_central_id(user_info.user_id).await? {
        Some(m) => (m, false),
        None => {
            if let Some(password_hash) = &identity.password_hash {
                match &req.password {
                    Some(password) => {
                        if !verify_password(password, password_hash).await {
                            return Err(AppError::BadRequest("Invalid server password".into()));
                        }
                    }
                    None => {
                        return Err(AppError::BadRequest(
                            "Server requires a password to join".into(),
                        ));
                    }
                }
            }

            let member_count = state.db.get_member_count().await?;
            if member_count >= identity.max_users {
                return Err(AppError::BadRequest("Server is full".into()));
            }

            let m = state
                .db
                .create_member(
                    user_info.user_id,
                    user_info.username,
                    user_info.kem_public_key,
                    user_info.dsa_public_key,
                )
                .await?;

            state
                .ws
                .broadcast_all(ServerMessage::MemberJoined { member: m.clone() })
                .await;

            (m, true)
        }
    };

    let (session_token, token_hash) = generate_session_token();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24 * 30);
    state
        .db
        .create_session(member.id, token_hash, expires_at)
        .await?;

    Ok(Json(LoginResponse {
        member_id: member.id,
        session_token,
        is_new_member: is_new,
    }))
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    auth: AuthMember,
) -> Result<Json<serde_json::Value>> {
    state.db.delete_member_sessions(auth.member_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

fn generate_session_token() -> (String, Vec<u8>) {
    use rand::RngCore;
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token = hex::encode(token_bytes);
    let token_hash = Sha256::digest(token_bytes).to_vec();
    (token, token_hash)
}
