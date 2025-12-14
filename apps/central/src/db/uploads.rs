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
        data: &[u8],
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
                SET content_type = $1, data = $2, file_size = $3, created_at = NOW()
                WHERE id = $4
                RETURNING *
                "#,
            )
            .bind(content_type)
            .bind(data)
            .bind(data.len() as i32)
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.into())
        } else {
            sqlx::query_as::<_, Upload>(
                r#"
                INSERT INTO uploads (user_id, file_type, content_type, data, file_size)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                "#,
            )
            .bind(user_id)
            .bind(file_type)
            .bind(content_type)
            .bind(data)
            .bind(data.len() as i32)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.into())
        }
    }

    pub async fn get_upload(&self, upload_id: Uuid) -> Result<Option<Upload>> {
        sqlx::query_as::<_, Upload>("SELECT * FROM uploads WHERE id = $1")
            .bind(upload_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.into())
    }

    pub async fn get_user_upload(&self, user_id: Uuid, file_type: &str) -> Result<Option<Upload>> {
        sqlx::query_as::<_, Upload>("SELECT * FROM uploads WHERE user_id = $1 AND file_type = $2")
            .bind(user_id)
            .bind(file_type)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.into())
    }

    pub async fn delete_upload(&self, user_id: Uuid, file_type: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM uploads WHERE user_id = $1 AND file_type = $2")
            .bind(user_id)
            .bind(file_type)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn delete_orphaned_uploads(&self, retention_days: u32) -> Result<u64> {
        let cutoff = Utc::now() - Duration::days(retention_days as i64);

        let result = sqlx::query(
            r#"
            DELETE FROM uploads
            WHERE created_at < $1
            AND id NOT IN (
                SELECT DISTINCT u.id
                FROM uploads u
                JOIN user_profiles p ON (
                    p.avatar_url LIKE '%' || u.id::text || '%'
                    OR p.banner_url LIKE '%' || u.id::text || '%'
                )
            )
            "#,
        )
        .bind(cutoff)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }
}
