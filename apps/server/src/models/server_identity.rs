use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ServerIdentity {
    pub id: Uuid,
    pub server_name: String,
    pub description: Option<String>,
    pub is_discoverable: bool,
    pub icon_url: Option<String>,
    pub max_users: i32,
    pub max_upload_size_mb: i32,
    pub message_retention: String,
    pub dsa_public_key: Vec<u8>,
    pub dsa_private_key_encrypted: Vec<u8>,
    pub central_registration_id: Option<Uuid>,
    pub owner_user_id: Option<Uuid>,
    pub setup_token_hash: Option<Vec<u8>>,
    pub password_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}
