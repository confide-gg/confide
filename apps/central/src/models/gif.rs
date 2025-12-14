use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FavoriteGif {
    pub id: Uuid,
    pub user_id: Uuid,
    pub gif_url: String,
    pub gif_preview_url: String,
    pub created_at: DateTime<Utc>,
}
