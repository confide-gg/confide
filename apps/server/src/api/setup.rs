use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::federation::verify_federation_token;
use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/claim", post(claim_ownership))
        .route("/status", get(get_status))
}

#[derive(Debug, Serialize)]
pub struct SetupStatusResponse {
    pub setup_complete: bool,
    pub server_name: Option<String>,
    pub central_registered: bool,
    pub dsa_public_key: Option<Vec<u8>>,
}

pub async fn get_status(State(state): State<Arc<AppState>>) -> Result<Json<SetupStatusResponse>> {
    let identity = state.db.get_server_identity().await?;

    match identity {
        Some(id) => Ok(Json(SetupStatusResponse {
            setup_complete: id.owner_user_id.is_some(),
            server_name: Some(id.server_name),
            central_registered: id.central_registration_id.is_some(),
            dsa_public_key: Some(id.dsa_public_key),
        })),
        None => Ok(Json(SetupStatusResponse {
            setup_complete: false,
            server_name: None,
            central_registered: false,
            dsa_public_key: None,
        })),
    }
}

#[derive(Debug, Deserialize)]
pub struct ClaimOwnershipRequest {
    pub setup_token: String,
    pub federation_token: String,
    pub user_id: Uuid,
    pub central_server_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct ClaimOwnershipResponse {
    pub success: bool,
    pub member_id: Uuid,
    pub session_token: String,
}

pub async fn claim_ownership(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ClaimOwnershipRequest>,
) -> Result<Json<ClaimOwnershipResponse>> {
    let identity = state
        .db
        .get_server_identity()
        .await?
        .ok_or(AppError::ServerNotSetup)?;

    if identity.owner_user_id.is_some() {
        return Err(AppError::BadRequest("Server already has an owner".into()));
    }

    let setup_token_hash = identity
        .setup_token_hash
        .clone()
        .ok_or(AppError::BadRequest("Setup already completed".into()))?;

    let token_bytes = hex::decode(&req.setup_token).map_err(|_| AppError::InvalidSetupToken)?;
    let provided_hash = Sha256::digest(&token_bytes).to_vec();
    if provided_hash != setup_token_hash {
        tracing::warn!("Setup token hash mismatch");
        return Err(AppError::InvalidSetupToken);
    }

    tracing::info!("Setup token verified. Verifying federation token with Central...");

    let user_info = verify_federation_token(
        &state.http_client,
        req.central_server_id,
        &req.federation_token,
        req.user_id,
        &state.config.server.central_url,
    )
    .await
    .map_err(|e| {
        tracing::error!("Federation verification error: {}", e);
        AppError::Federation(e)
    })?;

    if user_info.is_none() {
        tracing::warn!("Central returned valid=false for token verification");
        return Err(AppError::Unauthorized);
    }
    let user_info = user_info.unwrap();

    let member = state
        .db
        .create_member(
            user_info.user_id,
            user_info.username,
            user_info.kem_public_key,
            user_info.dsa_public_key,
        )
        .await?;

    state
        .db
        .set_server_owner(user_info.user_id, Some(req.central_server_id))
        .await?;

    let (session_token, token_hash) = generate_session_token();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24 * 30);
    state
        .db
        .create_session(member.id, token_hash, expires_at)
        .await?;

    if identity.central_registration_id.is_none() {
        if let Err(e) = register_with_central(&state, &identity).await {
            tracing::warn!("Failed to register with Central: {}", e);
        }
    }

    // Create default category
    let category = match state.db.create_category("General".to_string(), 0).await {
        Ok(c) => Some(c),
        Err(e) => {
            tracing::warn!("Failed to create default General category: {}", e);
            None
        }
    };

    let category_id = category.map(|c| c.id);

    if let Err(e) = state
        .db
        .create_channel(
            category_id,
            "general".to_string(),
            Some("General discussion".to_string()),
            0,
        )
        .await
    {
        tracing::warn!("Failed to create default General channel: {}", e);
    }

    Ok(Json(ClaimOwnershipResponse {
        success: true,
        member_id: member.id,
        session_token,
    }))
}

fn generate_session_token() -> (String, Vec<u8>) {
    use rand::RngCore;
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token = hex::encode(token_bytes);
    let token_hash = Sha256::digest(token_bytes).to_vec();
    (token, token_hash)
}

async fn register_with_central(
    state: &AppState,
    identity: &crate::models::ServerIdentity,
) -> Result<()> {
    #[derive(Serialize)]
    struct RegisterRequest {
        dsa_public_key: Vec<u8>,
        domain: String,
        display_name: String,
        description: Option<String>,
        is_discoverable: bool,
    }

    #[derive(Deserialize)]
    struct RegisterResponse {
        server_id: Uuid,
    }

    let request = RegisterRequest {
        dsa_public_key: identity.dsa_public_key.clone(),
        domain: state.config.server.public_domain.clone(),
        display_name: identity.server_name.clone(),
        description: identity.description.clone(),
        is_discoverable: identity.is_discoverable,
    };

    let response = state
        .http_client
        .post(format!(
            "{}/federation/register",
            &state.config.server.central_url
        ))
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Federation(e.to_string()))?;

    if response.status().is_success() {
        let result: RegisterResponse = response
            .json()
            .await
            .map_err(|e| AppError::Federation(e.to_string()))?;

        state
            .db
            .update_central_registration(result.server_id)
            .await?;
    }

    Ok(())
}
