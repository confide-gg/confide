use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::Result;
use crate::models::RegisteredServer;
use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/servers", get(list_servers))
        .route("/search", get(search_servers))
        .route("/active", get(get_active_servers))
}

#[derive(Debug, Deserialize)]
pub struct ListServersQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Debug, Serialize)]
pub struct ListServersResponse {
    pub servers: Vec<RegisteredServer>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list_servers(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListServersQuery>,
) -> Result<Json<ListServersResponse>> {
    let limit = query.limit.clamp(1, 100);
    let offset = query.offset.max(0);

    let servers = state.db.get_discoverable_servers(limit, offset).await?;
    let total = state.db.count_discoverable_servers().await?;

    Ok(Json(ListServersResponse {
        servers,
        total,
        limit,
        offset,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SearchServersQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

pub async fn search_servers(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchServersQuery>,
) -> Result<Json<ListServersResponse>> {
    let limit = query.limit.clamp(1, 100);
    let offset = query.offset.max(0);

    let servers = state
        .db
        .search_discoverable_servers(&query.q, limit, offset)
        .await?;
    let total = servers.len() as i64;

    Ok(Json(ListServersResponse {
        servers,
        total,
        limit,
        offset,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ActiveServersQuery {
    #[serde(default = "default_active_limit")]
    pub limit: i64,
}

fn default_active_limit() -> i64 {
    10
}

pub async fn get_active_servers(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ActiveServersQuery>,
) -> Result<Json<Vec<RegisteredServer>>> {
    let limit = query.limit.clamp(1, 50);
    let servers = state.db.get_recently_active_servers(limit).await?;
    Ok(Json(servers))
}
