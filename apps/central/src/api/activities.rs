use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, put},
    Json, Router,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::Result;
use crate::models::{PublicActivity, UpdateActivityRequest, UserActivity};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/me", get(get_my_activity))
        .route("/me", put(update_my_activity))
        .route("/me", delete(delete_my_activity))
        .route("/{user_id}", get(get_user_activity))
}

pub async fn get_my_activity(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Option<UserActivity>>> {
    let activity = state.db.get_user_activity(auth.user_id).await?;
    Ok(Json(activity))
}

pub async fn update_my_activity(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UpdateActivityRequest>,
) -> Result<Json<UserActivity>> {
    let activity = state.db.upsert_user_activity(auth.user_id, &req).await?;
    crate::ws::broadcast_activity_update(&state, auth.user_id, Some(activity.clone().into())).await;
    Ok(Json(activity))
}

pub async fn delete_my_activity(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<StatusCode> {
    state.db.delete_user_activity(auth.user_id).await?;
    crate::ws::broadcast_activity_update(&state, auth.user_id, None).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_user_activity(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Option<PublicActivity>>> {
    let profile = state.db.get_profile(user_id).await?;

    let status = profile
        .as_ref()
        .map(|p| p.status.as_str())
        .unwrap_or("offline");
    if status == "offline" || status == "invisible" {
        return Ok(Json(None));
    }

    let activity = state.db.get_user_activity(user_id).await?;
    Ok(Json(activity.map(|a| a.into())))
}
