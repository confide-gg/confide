use axum::{
    extract::State,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::Result;
use crate::models::FavoriteGif;
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/favorites", get(get_favorites))
        .route("/favorites", post(add_favorite))
        .route("/favorites", delete(remove_favorite))
}

pub async fn get_favorites(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Vec<FavoriteGif>>> {
    let gifs = state.db.get_favorite_gifs(auth.user_id).await?;
    Ok(Json(gifs))
}

#[derive(Debug, Deserialize)]
pub struct AddFavoriteRequest {
    pub gif_url: String,
    pub gif_preview_url: String,
}

pub async fn add_favorite(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<AddFavoriteRequest>,
) -> Result<Json<FavoriteGif>> {
    let gif = state
        .db
        .add_favorite_gif(auth.user_id, &req.gif_url, &req.gif_preview_url)
        .await?;
    Ok(Json(gif))
}

#[derive(Debug, Deserialize)]
pub struct RemoveFavoriteRequest {
    pub gif_url: String,
}

#[derive(Debug, Serialize)]
pub struct RemoveFavoriteResponse {
    pub success: bool,
}

pub async fn remove_favorite(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<RemoveFavoriteRequest>,
) -> Result<Json<RemoveFavoriteResponse>> {
    let success = state
        .db
        .remove_favorite_gif(auth.user_id, &req.gif_url)
        .await?;
    Ok(Json(RemoveFavoriteResponse { success }))
}
