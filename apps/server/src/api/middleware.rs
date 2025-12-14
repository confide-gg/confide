use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::AppError;
use crate::AppState;

pub struct AuthMember {
    pub member_id: Uuid,
    #[allow(dead_code)]
    pub central_user_id: Uuid,
}

impl FromRequestParts<Arc<AppState>> for AuthMember {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let token_bytes = hex::decode(token).map_err(|_| AppError::Unauthorized)?;
        let token_hash = Sha256::digest(&token_bytes).to_vec();

        let session = state
            .db
            .get_session_by_token(&token_hash)
            .await?
            .ok_or(AppError::Unauthorized)?;

        if session.expires_at < chrono::Utc::now() {
            return Err(AppError::Unauthorized);
        }

        let member = state
            .db
            .get_member(session.member_id)
            .await?
            .ok_or(AppError::Unauthorized)?;

        Ok(AuthMember {
            member_id: member.id,
            central_user_id: member.central_user_id,
        })
    }
}
