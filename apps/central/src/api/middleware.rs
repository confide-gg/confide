use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::AppError;
use crate::AppState;

#[derive(Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub session_id: Uuid,
}

impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let token_bytes = hex::decode(token).map_err(|_| AppError::Unauthorized)?;
        let token_hash = Sha256::digest(&token_bytes).to_vec();

        let session = state
            .db
            .get_session_by_token_hash(&token_hash)
            .await?
            .ok_or(AppError::Unauthorized)?;

        if session.expires_at < chrono::Utc::now() {
            return Err(AppError::Unauthorized);
        }

        Ok(AuthUser {
            user_id: session.user_id,
            session_id: session.id,
        })
    }
}
