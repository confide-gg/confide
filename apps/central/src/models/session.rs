use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct UserPrekeys {
    pub user_id: Uuid,
    pub signed_prekey_public: Vec<u8>,
    pub signed_prekey_signature: Vec<u8>,
    pub signed_prekey_id: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct OneTimePrekey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub prekey_id: i32,
    pub public_key: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RatchetSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub peer_user_id: Uuid,
    pub conversation_id: Uuid,
    pub encrypted_state: Vec<u8>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PendingKeyExchange {
    pub id: Uuid,
    pub from_user_id: Uuid,
    pub to_user_id: Uuid,
    pub conversation_id: Uuid,
    pub key_bundle: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreKeyBundle {
    pub identity_key: Vec<u8>,
    pub signed_prekey_public: Vec<u8>,
    pub signed_prekey_signature: Vec<u8>,
    pub signed_prekey_id: i32,
    pub one_time_prekey: Option<OneTimePrekeyInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneTimePrekeyInfo {
    pub prekey_id: i32,
    pub public_key: Vec<u8>,
}
