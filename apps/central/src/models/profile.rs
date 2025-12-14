use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Default)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum UserStatus {
    #[default]
    Online,
    Away,
    Dnd,
    Invisible,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserProfile {
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub status: String,
    pub custom_status: Option<String>,
    pub accent_color: Option<String>,
    pub banner_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicProfile {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub status: String,
    pub custom_status: Option<String>,
    pub accent_color: Option<String>,
    pub banner_url: Option<String>,
    pub member_since: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub status: Option<String>,
    pub custom_status: Option<String>,
    pub accent_color: Option<String>,
    pub banner_url: Option<String>,
}
