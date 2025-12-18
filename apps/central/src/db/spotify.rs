use chrono::{DateTime, Utc};
use sqlx::Error;
use uuid::Uuid;

use super::Database;
use crate::models::SpotifyIntegration;

impl Database {
    pub async fn get_spotify_integration(
        &self,
        user_id: Uuid,
    ) -> Result<Option<SpotifyIntegration>, Error> {
        sqlx::query_as::<_, SpotifyIntegration>(
            r#"SELECT user_id, access_token, refresh_token, token_expires_at, scope,
                      display_in_profile, created_at, updated_at
               FROM spotify_integrations WHERE user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn upsert_spotify_integration(
        &self,
        user_id: Uuid,
        access_token: &str,
        refresh_token: &str,
        token_expires_at: DateTime<Utc>,
        scope: &str,
    ) -> Result<(), Error> {
        sqlx::query(
            r#"
            INSERT INTO spotify_integrations (
                user_id, access_token, refresh_token, token_expires_at, scope
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                access_token = $2,
                refresh_token = $3,
                token_expires_at = $4,
                scope = $5,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(access_token)
        .bind(refresh_token)
        .bind(token_expires_at)
        .bind(scope)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_spotify_integration(&self, user_id: Uuid) -> Result<(), Error> {
        sqlx::query("DELETE FROM spotify_integrations WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_active_spotify_integrations(&self) -> Result<Vec<SpotifyIntegration>, Error> {
        sqlx::query_as::<_, SpotifyIntegration>(
            r#"SELECT user_id, access_token, refresh_token, token_expires_at, scope,
                      display_in_profile, created_at, updated_at
               FROM spotify_integrations
               WHERE display_in_profile = TRUE"#,
        )
        .fetch_all(&self.pool)
        .await
    }
}
