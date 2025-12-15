use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPreferences {
    pub user_id: Uuid,
    pub theme: String,
    pub enable_snow_effect: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub theme: Option<String>,
    pub enable_snow_effect: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSnowEffectRequest {
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreferencesResponse {
    pub theme: String,
    pub enable_snow_effect: bool,
}
