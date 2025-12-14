use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPreferences {
    pub user_id: Uuid,
    pub theme: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreferencesResponse {
    pub theme: String,
}
