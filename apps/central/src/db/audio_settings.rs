use sqlx::Error;
use uuid::Uuid;

use super::Database;
use crate::models::{AudioSettings, UpdateAudioSettingsRequest};

impl Database {
    pub async fn get_audio_settings(&self, user_id: Uuid) -> Result<Option<AudioSettings>, Error> {
        sqlx::query_as::<_, AudioSettings>(
            r#"SELECT user_id, input_volume, output_volume, input_sensitivity, voice_activity_enabled, push_to_talk_enabled, push_to_talk_key, updated_at
               FROM user_audio_settings WHERE user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_or_create_audio_settings(
        &self,
        user_id: Uuid,
    ) -> Result<AudioSettings, Error> {
        sqlx::query_as::<_, AudioSettings>(
            r#"
            INSERT INTO user_audio_settings (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
            RETURNING user_id, input_volume, output_volume, input_sensitivity, voice_activity_enabled, push_to_talk_enabled, push_to_talk_key, updated_at
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update_audio_settings(
        &self,
        user_id: Uuid,
        req: &UpdateAudioSettingsRequest,
    ) -> Result<AudioSettings, Error> {
        sqlx::query_as::<_, AudioSettings>(
            r#"
            INSERT INTO user_audio_settings (user_id, input_volume, output_volume, input_sensitivity, voice_activity_enabled, push_to_talk_enabled, push_to_talk_key)
            VALUES ($1, COALESCE($2, 1.0), COALESCE($3, 1.0), COALESCE($4, 0.3), COALESCE($5, false), COALESCE($6, false), $7)
            ON CONFLICT (user_id) DO UPDATE SET
                input_volume = COALESCE($2, user_audio_settings.input_volume),
                output_volume = COALESCE($3, user_audio_settings.output_volume),
                input_sensitivity = COALESCE($4, user_audio_settings.input_sensitivity),
                voice_activity_enabled = COALESCE($5, user_audio_settings.voice_activity_enabled),
                push_to_talk_enabled = COALESCE($6, user_audio_settings.push_to_talk_enabled),
                push_to_talk_key = COALESCE($7, user_audio_settings.push_to_talk_key),
                updated_at = NOW()
            RETURNING user_id, input_volume, output_volume, input_sensitivity, voice_activity_enabled, push_to_talk_enabled, push_to_talk_key, updated_at
            "#,
        )
        .bind(user_id)
        .bind(req.input_volume)
        .bind(req.output_volume)
        .bind(req.input_sensitivity)
        .bind(req.voice_activity_enabled)
        .bind(req.push_to_talk_enabled)
        .bind(&req.push_to_talk_key)
        .fetch_one(&self.pool)
        .await
    }
}
