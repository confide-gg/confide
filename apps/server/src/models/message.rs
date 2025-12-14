use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Message {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub sender_id: Uuid,
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Upload {
    pub id: Uuid,
    pub uploader_id: Uuid,
    pub filename: String,
    pub content_type: String,
    pub file_size: i64,
    pub storage_path: String,
    pub created_at: DateTime<Utc>,
}
