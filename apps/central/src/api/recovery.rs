use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;

use crate::crypto;
use crate::error::{AppError, Result};
use crate::models::{PublicUser, RecoveryKeys, UserKeys};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/setup", post(setup_recovery))
        .route("/status", get(get_status))
        .route("/data", post(get_recovery_data))
        .route("/reset", post(reset_password))
}

#[derive(Debug, Deserialize)]
pub struct SetupRecoveryRequest {
    pub recovery_kem_encrypted_private: Vec<u8>,
    pub recovery_dsa_encrypted_private: Vec<u8>,
    pub recovery_key_salt: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct RecoveryStatusResponse {
    pub recovery_setup_completed: bool,
}

pub async fn setup_recovery(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<SetupRecoveryRequest>,
) -> Result<Json<RecoveryStatusResponse>> {
    let recovery_keys = RecoveryKeys {
        recovery_kem_encrypted_private: req.recovery_kem_encrypted_private,
        recovery_dsa_encrypted_private: req.recovery_dsa_encrypted_private,
        recovery_key_salt: req.recovery_key_salt,
    };

    state.db.setup_recovery(auth.user_id, recovery_keys).await?;

    Ok(Json(RecoveryStatusResponse {
        recovery_setup_completed: true,
    }))
}

pub async fn get_status(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<RecoveryStatusResponse>> {
    let completed = state.db.get_recovery_status(auth.user_id).await?;

    Ok(Json(RecoveryStatusResponse {
        recovery_setup_completed: completed,
    }))
}

#[derive(Debug, Deserialize)]
pub struct GetRecoveryDataRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct RecoveryDataResponse {
    pub user_id: String,
    pub recovery_kem_encrypted_private: Vec<u8>,
    pub recovery_dsa_encrypted_private: Vec<u8>,
    pub recovery_key_salt: Vec<u8>,
}

pub async fn get_recovery_data(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GetRecoveryDataRequest>,
) -> Result<Json<RecoveryDataResponse>> {
    let data = state
        .db
        .get_recovery_data(&req.username)
        .await?
        .ok_or(AppError::RecoveryNotSetup)?;

    Ok(Json(RecoveryDataResponse {
        user_id: data.0.to_string(),
        recovery_kem_encrypted_private: data.1,
        recovery_dsa_encrypted_private: data.2,
        recovery_key_salt: data.3,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub username: String,
    pub new_password: String,
    pub kem_public_key: Vec<u8>,
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
    pub recovery_kem_encrypted_private: Vec<u8>,
    pub recovery_dsa_encrypted_private: Vec<u8>,
    pub recovery_key_salt: Vec<u8>,
    pub recovery_proof_signature: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct ResetPasswordResponse {
    pub user: PublicUser,
    pub token: String,
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<ResetPasswordResponse>> {
    if req.new_password.len() < state.config.auth.password_min_length {
        return Err(AppError::BadRequest(format!(
            "password must be at least {} characters",
            state.config.auth.password_min_length
        )));
    }

    let user = state
        .db
        .get_user_by_username(&req.username)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if !user.recovery_setup_completed {
        return Err(AppError::RecoveryNotSetup);
    }

    let proof_message = format!("password_reset:{}", user.id);
    let signature_valid = confide_sdk::crypto::keys::DsaKeyPair::verify(
        &user.dsa_public_key,
        proof_message.as_bytes(),
        &req.recovery_proof_signature,
    )
    .unwrap_or(false);

    if !signature_valid {
        return Err(AppError::BadRequest(
            "Invalid recovery proof - must sign with recovered DSA key".into(),
        ));
    }

    let new_password_hash =
        crypto::hash_password(&req.new_password, &state.config.crypto.to_argon2_config())?;

    let new_keys = UserKeys {
        kem_public_key: req.kem_public_key.clone(),
        kem_encrypted_private: req.kem_encrypted_private,
        dsa_public_key: req.dsa_public_key.clone(),
        dsa_encrypted_private: req.dsa_encrypted_private,
        key_salt: req.key_salt,
    };

    let new_recovery_keys = RecoveryKeys {
        recovery_kem_encrypted_private: req.recovery_kem_encrypted_private,
        recovery_dsa_encrypted_private: req.recovery_dsa_encrypted_private,
        recovery_key_salt: req.recovery_key_salt,
    };

    state
        .db
        .reset_password_with_recovery(user.id, new_password_hash, new_keys, new_recovery_keys)
        .await?;

    state.db.delete_user_sessions(user.id).await?;

    let (token, token_hash) = generate_token();
    state
        .db
        .create_session(user.id, token_hash, state.config.auth.token_expiry_hours)
        .await?;

    Ok(Json(ResetPasswordResponse {
        user: PublicUser {
            id: user.id,
            username: user.username,
            kem_public_key: req.kem_public_key,
            dsa_public_key: req.dsa_public_key,
        },
        token,
    }))
}

fn generate_token() -> (String, Vec<u8>) {
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token = hex::encode(token_bytes);
    let token_hash = Sha256::digest(token_bytes).to_vec();
    (token, token_hash)
}
