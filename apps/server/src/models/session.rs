use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Session {
    pub id: Uuid,
    pub member_id: Uuid,
    pub token_hash: Vec<u8>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
