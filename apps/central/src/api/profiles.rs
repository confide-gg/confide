use axum::{
    extract::{Path, State},
    routing::{get, put},
    Json, Router,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::Result;
use crate::models::{PublicProfile, UpdateProfileRequest, UserProfile};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/me", get(get_my_profile))
        .route("/me", put(update_my_profile))
        .route("/{user_id}", get(get_user_profile))
}

pub async fn get_my_profile(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Option<UserProfile>>> {
    let profile = state.db.get_profile(auth.user_id).await?;
    Ok(Json(profile))
}

pub async fn update_my_profile(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserProfile>> {
    let profile = state.db.update_profile(auth.user_id, &req).await?;
    Ok(Json(profile))
}

pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Option<PublicProfile>>> {
    let profile = state.db.get_public_profile(user_id).await?;
    Ok(Json(profile))
}
