use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AudioSettings {
    pub user_id: Uuid,
    pub input_volume: f32,
    pub output_volume: f32,
    pub input_sensitivity: f32,
    pub voice_activity_enabled: bool,
    pub push_to_talk_enabled: bool,
    pub push_to_talk_key: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateAudioSettingsRequest {
    pub input_volume: Option<f32>,
    pub output_volume: Option<f32>,
    pub input_sensitivity: Option<f32>,
    pub voice_activity_enabled: Option<bool>,
    pub push_to_talk_enabled: Option<bool>,
    pub push_to_talk_key: Option<String>,
}
