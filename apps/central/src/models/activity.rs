use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum ActivityType {
    Playing,
    Listening,
    Watching,
    Streaming,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserActivity {
    pub user_id: Uuid,
    pub activity_type: String,
    pub name: Option<String>,
    pub details: Option<String>,
    pub state: Option<String>,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
    pub large_image_url: Option<String>,
    pub small_image_url: Option<String>,
    pub large_image_text: Option<String>,
    pub small_image_text: Option<String>,
    pub metadata: Option<JsonValue>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SpotifyIntegration {
    pub user_id: Uuid,
    pub access_token: String,
    pub refresh_token: String,
    pub token_expires_at: DateTime<Utc>,
    pub scope: String,
    pub display_in_profile: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SpotifyTrack {
    pub name: String,
    pub artist: String,
    pub album: String,
    pub album_image_url: Option<String>,
    pub duration_ms: i64,
    pub progress_ms: i64,
    pub is_playing: bool,
    pub track_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateActivityRequest {
    pub activity_type: Option<String>,
    pub name: Option<String>,
    pub details: Option<String>,
    pub state: Option<String>,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
    pub large_image_url: Option<String>,
    pub small_image_url: Option<String>,
    pub large_image_text: Option<String>,
    pub small_image_text: Option<String>,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicActivity {
    pub user_id: Uuid,
    pub activity_type: String,
    pub name: Option<String>,
    pub details: Option<String>,
    pub state: Option<String>,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
    pub large_image_url: Option<String>,
    pub small_image_url: Option<String>,
    pub large_image_text: Option<String>,
    pub small_image_text: Option<String>,
    pub track_url: Option<String>,
}

impl From<UserActivity> for PublicActivity {
    fn from(activity: UserActivity) -> Self {
        let track_url = activity
            .metadata
            .as_ref()
            .and_then(|m| m.get("track_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Self {
            user_id: activity.user_id,
            activity_type: activity.activity_type,
            name: activity.name,
            details: activity.details,
            state: activity.state,
            start_timestamp: activity.start_timestamp,
            end_timestamp: activity.end_timestamp,
            large_image_url: activity.large_image_url,
            small_image_url: activity.small_image_url,
            large_image_text: activity.large_image_text,
            small_image_text: activity.small_image_text,
            track_url,
        }
    }
}
