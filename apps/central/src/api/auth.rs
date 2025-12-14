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
use crate::models::{PublicUser, UserKeys};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(me))
        .route("/logout", post(logout))
        .route("/keys", get(get_keys))
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub kem_public_key: Vec<u8>,
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: PublicUser,
    pub token: String,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    if req.username.len() < 3 {
        return Err(AppError::BadRequest(
            "username must be at least 3 characters".into(),
        ));
    }

    if req.password.len() < state.config.auth.password_min_length {
        return Err(AppError::BadRequest(format!(
            "password must be at least {} characters",
            state.config.auth.password_min_length
        )));
    }

    let password_hash =
        crypto::hash_password(&req.password, &state.config.crypto.to_argon2_config())?;

    let keys = UserKeys {
        kem_public_key: req.kem_public_key,
        kem_encrypted_private: req.kem_encrypted_private,
        dsa_public_key: req.dsa_public_key,
        dsa_encrypted_private: req.dsa_encrypted_private,
        key_salt: req.key_salt,
    };

    let user = state
        .db
        .create_user(&req.username, password_hash, keys)
        .await?;

    let (token, token_hash) = generate_token();
    state
        .db
        .create_session(user.id, token_hash, state.config.auth.token_expiry_hours)
        .await?;

    tokio::spawn({
        let state = Arc::clone(&state);
        let user_id = user.id;
        let kem_public_key = user.kem_public_key.clone();
        async move {
            crate::ws::broadcast_key_update(&state, user_id, kem_public_key).await;
        }
    });

    Ok(Json(AuthResponse {
        user: user.into(),
        token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: PublicUser,
    pub token: String,
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    let user = state
        .db
        .get_user_by_username(&req.username)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    let valid = crypto::verify_password(&req.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::InvalidCredentials);
    }

    let (token, token_hash) = generate_token();
    state
        .db
        .create_session(user.id, token_hash, state.config.auth.token_expiry_hours)
        .await?;

    Ok(Json(LoginResponse {
        user: PublicUser {
            id: user.id,
            username: user.username,
            kem_public_key: user.kem_public_key,
            dsa_public_key: user.dsa_public_key,
        },
        token,
        kem_encrypted_private: user.kem_encrypted_private,
        dsa_encrypted_private: user.dsa_encrypted_private,
        key_salt: user.key_salt,
    }))
}

pub async fn me(State(state): State<Arc<AppState>>, auth: AuthUser) -> Result<Json<PublicUser>> {
    let user = state
        .db
        .get_public_user(auth.user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;
    Ok(Json(user))
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>> {
    state.db.delete_session(auth.session_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Serialize)]
pub struct KeysResponse {
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
}

pub async fn get_keys(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<KeysResponse>> {
    let user = state
        .db
        .get_user_by_id(auth.user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    Ok(Json(KeysResponse {
        kem_encrypted_private: user.kem_encrypted_private,
        dsa_encrypted_private: user.dsa_encrypted_private,
        key_salt: user.key_salt,
    }))
}

fn generate_token() -> (String, Vec<u8>) {
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token = hex::encode(token_bytes);
    let token_hash = Sha256::digest(token_bytes).to_vec();
    (token, token_hash)
}
