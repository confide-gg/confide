use sqlx::Error;
use uuid::Uuid;

use super::Database;
use crate::models::{UpdatePreferencesRequest, UserPreferences};

impl Database {
    pub async fn get_preferences(&self, user_id: Uuid) -> Result<Option<UserPreferences>, Error> {
        sqlx::query_as::<_, UserPreferences>(
            r#"SELECT user_id, theme, created_at, updated_at
               FROM user_preferences WHERE user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_or_create_preferences(&self, user_id: Uuid) -> Result<UserPreferences, Error> {
        sqlx::query_as::<_, UserPreferences>(
            r#"
            INSERT INTO user_preferences (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
            RETURNING user_id, theme, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update_preferences(
        &self,
        user_id: Uuid,
        req: &UpdatePreferencesRequest,
    ) -> Result<UserPreferences, Error> {
        sqlx::query_as::<_, UserPreferences>(
            r#"
            INSERT INTO user_preferences (user_id, theme)
            VALUES ($1, COALESCE($2, 'dark'))
            ON CONFLICT (user_id) DO UPDATE SET
                theme = COALESCE($2, user_preferences.theme),
                updated_at = NOW()
            RETURNING user_id, theme, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(&req.theme)
        .fetch_one(&self.pool)
        .await
    }
}
