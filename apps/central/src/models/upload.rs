use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Upload {
    pub id: Uuid,
    pub user_id: Uuid,
    pub file_type: String,
    pub content_type: String,
    #[serde(skip_serializing)]
    pub data: Vec<u8>,
    pub file_size: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadResponse {
    pub id: Uuid,
    pub url: String,
}
