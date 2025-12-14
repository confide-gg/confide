use uuid::Uuid;

use crate::error::Result;
use crate::models::FavoriteGif;

use super::Database;

impl Database {
    pub async fn get_favorite_gifs(&self, user_id: Uuid) -> Result<Vec<FavoriteGif>> {
        let gifs = sqlx::query_as::<_, FavoriteGif>(
            "SELECT * FROM favorite_gifs WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(gifs)
    }

    pub async fn add_favorite_gif(
        &self,
        user_id: Uuid,
        gif_url: &str,
        gif_preview_url: &str,
    ) -> Result<FavoriteGif> {
        let gif = sqlx::query_as::<_, FavoriteGif>(
            r#"
            INSERT INTO favorite_gifs (user_id, gif_url, gif_preview_url)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, gif_url) DO UPDATE SET created_at = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(gif_url)
        .bind(gif_preview_url)
        .fetch_one(&self.pool)
        .await?;
        Ok(gif)
    }

    pub async fn remove_favorite_gif(&self, user_id: Uuid, gif_url: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM favorite_gifs WHERE user_id = $1 AND gif_url = $2")
            .bind(user_id)
            .bind(gif_url)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn is_gif_favorited(&self, user_id: Uuid, gif_url: &str) -> Result<bool> {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM favorite_gifs WHERE user_id = $1 AND gif_url = $2)",
        )
        .bind(user_id)
        .bind(gif_url)
        .fetch_one(&self.pool)
        .await?;
        Ok(exists)
    }
}
