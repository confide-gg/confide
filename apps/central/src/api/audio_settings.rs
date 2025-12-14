use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use std::sync::Arc;

use crate::error::Result;
use crate::models::{AudioSettings, UpdateAudioSettingsRequest};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_audio_settings))
        .route("/", put(update_audio_settings))
}

pub async fn get_audio_settings(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<AudioSettings>> {
    let settings = state.db.get_or_create_audio_settings(auth.user_id).await?;
    Ok(Json(settings))
}

pub async fn update_audio_settings(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UpdateAudioSettingsRequest>,
) -> Result<Json<AudioSettings>> {
    let settings = state.db.update_audio_settings(auth.user_id, &req).await?;
    Ok(Json(settings))
}
