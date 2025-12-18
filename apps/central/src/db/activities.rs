use sqlx::Error;
use uuid::Uuid;

use super::Database;
use crate::models::{UpdateActivityRequest, UserActivity};

impl Database {
    pub async fn get_user_activity(&self, user_id: Uuid) -> Result<Option<UserActivity>, Error> {
        sqlx::query_as::<_, UserActivity>(
            r#"SELECT user_id, activity_type, name, details, state, start_timestamp, end_timestamp,
                      large_image_url, small_image_url, large_image_text, small_image_text,
                      metadata, updated_at
               FROM user_activities WHERE user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn upsert_user_activity(
        &self,
        user_id: Uuid,
        req: &UpdateActivityRequest,
    ) -> Result<UserActivity, Error> {
        sqlx::query_as::<_, UserActivity>(
            r#"
            INSERT INTO user_activities (
                user_id, activity_type, name, details, state,
                start_timestamp, end_timestamp,
                large_image_url, small_image_url,
                large_image_text, small_image_text,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (user_id) DO UPDATE SET
                activity_type = COALESCE($2, user_activities.activity_type),
                name = $3,
                details = $4,
                state = $5,
                start_timestamp = $6,
                end_timestamp = $7,
                large_image_url = $8,
                small_image_url = $9,
                large_image_text = $10,
                small_image_text = $11,
                metadata = $12,
                updated_at = NOW()
            RETURNING user_id, activity_type, name, details, state,
                      start_timestamp, end_timestamp,
                      large_image_url, small_image_url,
                      large_image_text, small_image_text,
                      metadata, updated_at
            "#,
        )
        .bind(user_id)
        .bind(&req.activity_type)
        .bind(&req.name)
        .bind(&req.details)
        .bind(&req.state)
        .bind(req.start_timestamp)
        .bind(req.end_timestamp)
        .bind(&req.large_image_url)
        .bind(&req.small_image_url)
        .bind(&req.large_image_text)
        .bind(&req.small_image_text)
        .bind(&req.metadata)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn delete_user_activity(&self, user_id: Uuid) -> Result<(), Error> {
        sqlx::query("DELETE FROM user_activities WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
