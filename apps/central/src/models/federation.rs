use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct RegisteredServer {
    pub id: Uuid,
    pub dsa_public_key: Vec<u8>,
    pub domain: String,
    pub display_name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub member_count: i32,
    pub owner_id: Uuid,
    pub is_discoverable: bool,
    pub last_heartbeat: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct FederationToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub server_id: Uuid,
    pub token_hash: Vec<u8>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederationUserInfo {
    pub user_id: Uuid,
    pub username: String,
    pub kem_public_key: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
}
