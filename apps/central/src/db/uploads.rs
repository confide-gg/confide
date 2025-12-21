use chrono::{Duration, Utc};
use uuid::Uuid;

use super::Database;
use crate::error::Result;
use crate::models::Upload;

impl Database {
    pub async fn save_upload(
        &self,
        user_id: Uuid,
        file_type: &str,
        content_type: &str,
        s3_key: &str,
        file_size: i32,
    ) -> Result<Upload> {
        let existing: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM uploads WHERE user_id = $1 AND file_type = $2")
                .bind(user_id)
                .bind(file_type)
                .fetch_optional(&self.pool)
                .await?;

        if let Some((id,)) = existing {
            sqlx::query_as::<_, Upload>(
                r#"
                UPDATE uploads
                SET content_type = $1, s3_key = $2, file_size = $3, created_at = NOW()
                WHERE id = $4
                RETURNING id, user_id, file_type, content_type, s3_key, file_size, created_at
                "#,
            )
            .bind(content_type)
            .bind(s3_key)
            .bind(file_size)
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.into())
        } else {
            sqlx::query_as::<_, Upload>(
                r#"
                INSERT INTO uploads (user_id, file_type, content_type, s3_key, file_size)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, user_id, file_type, content_type, s3_key, file_size, created_at
                "#,
            )
            .bind(user_id)
            .bind(file_type)
            .bind(content_type)
            .bind(s3_key)
            .bind(file_size)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.into())
        }
    }

    pub async fn get_upload(&self, upload_id: Uuid) -> Result<Option<Upload>> {
        sqlx::query_as::<_, Upload>(
            "SELECT id, user_id, file_type, content_type, s3_key, file_size, created_at FROM uploads WHERE id = $1",
        )
        .bind(upload_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.into())
    }

    pub async fn get_upload_by_s3_key(&self, s3_key: &str) -> Result<Option<Upload>> {
        sqlx::query_as::<_, Upload>(
            "SELECT id, user_id, file_type, content_type, s3_key, file_size, created_at FROM uploads WHERE s3_key = $1",
        )
        .bind(s3_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.into())
    }

    pub async fn get_user_upload(&self, user_id: Uuid, file_type: &str) -> Result<Option<Upload>> {
        sqlx::query_as::<_, Upload>(
            "SELECT id, user_id, file_type, content_type, s3_key, file_size, created_at FROM uploads WHERE user_id = $1 AND file_type = $2",
        )
        .bind(user_id)
        .bind(file_type)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.into())
    }

    pub async fn delete_upload(&self, user_id: Uuid, file_type: &str) -> Result<Option<String>> {
        let result: Option<(String,)> = sqlx::query_as(
            "DELETE FROM uploads WHERE user_id = $1 AND file_type = $2 RETURNING s3_key",
        )
        .bind(user_id)
        .bind(file_type)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|(s3_key,)| s3_key))
    }

    pub async fn delete_orphaned_uploads(&self, retention_days: u32) -> Result<Vec<String>> {
        let cutoff = Utc::now() - Duration::days(retention_days as i64);

        let deleted: Vec<(String,)> = sqlx::query_as(
            r#"
            DELETE FROM uploads
            WHERE created_at < $1
            AND id NOT IN (
                SELECT DISTINCT u.id
                FROM uploads u
                JOIN user_profiles p ON (
                    p.avatar_url LIKE '%' || u.s3_key || '%'
                    OR p.banner_url LIKE '%' || u.s3_key || '%'
                )
            )
            RETURNING s3_key
            "#,
        )
        .bind(cutoff)
        .fetch_all(&self.pool)
        .await?;

        Ok(deleted.into_iter().map(|(key,)| key).collect())
    }
}
