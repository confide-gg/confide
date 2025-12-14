use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::Result;
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/federated", get(get_federated_servers))
        .route("/federated", put(update_federated_servers))
}

#[derive(Debug, Serialize)]
pub struct FederatedServersResponse {
    pub encrypted_servers: Vec<u8>,
}

pub async fn get_federated_servers(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<FederatedServersResponse>> {
    let servers = state
        .db
        .get_user_servers(auth.user_id)
        .await?
        .map(|s| s.encrypted_servers)
        .unwrap_or_default();

    Ok(Json(FederatedServersResponse {
        encrypted_servers: servers,
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFederatedServersRequest {
    pub encrypted_servers: Vec<u8>,
}

pub async fn update_federated_servers(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UpdateFederatedServersRequest>,
) -> Result<Json<serde_json::Value>> {
    state
        .db
        .update_user_servers(auth.user_id, req.encrypted_servers)
        .await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
