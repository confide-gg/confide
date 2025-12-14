use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use std::sync::Arc;

use crate::error::Result;
use crate::models::{PreferencesResponse, UpdatePreferencesRequest};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_preferences))
        .route("/theme", put(update_theme))
}

pub async fn get_preferences(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<PreferencesResponse>> {
    let prefs = state.db.get_or_create_preferences(auth.user_id).await?;
    Ok(Json(PreferencesResponse { theme: prefs.theme }))
}

pub async fn update_theme(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UpdatePreferencesRequest>,
) -> Result<Json<PreferencesResponse>> {
    let prefs = state.db.update_preferences(auth.user_id, &req).await?;
    Ok(Json(PreferencesResponse { theme: prefs.theme }))
}
