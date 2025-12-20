use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::Result;

use super::Database;

#[derive(Debug, FromRow)]
pub struct AttachmentRecord {
    pub id: Uuid,
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub uploader_id: Uuid,
    pub s3_key: String,
    pub file_size_bytes: i64,
    pub encrypted_size_bytes: i64,
    pub mime_type: String,
}

impl Database {
    #[allow(clippy::too_many_arguments)]
    pub async fn save_attachment(
        &self,
        message_id: Uuid,
        conversation_id: Uuid,
        uploader_id: Uuid,
        s3_key: &str,
        file_size: i64,
        encrypted_size: i64,
        mime_type: &str,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<Uuid> {
        let id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO file_attachments
            (message_id, conversation_id, uploader_id, s3_key, file_size_bytes,
             encrypted_size_bytes, mime_type, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            "#,
        )
        .bind(message_id)
        .bind(conversation_id)
        .bind(uploader_id)
        .bind(s3_key)
        .bind(file_size)
        .bind(encrypted_size)
        .bind(mime_type)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn get_attachment_by_s3_key(&self, s3_key: &str) -> Result<Option<AttachmentRecord>> {
        let record = sqlx::query_as::<_, AttachmentRecord>(
            r#"
            SELECT id, message_id, conversation_id, uploader_id, s3_key,
                   file_size_bytes, encrypted_size_bytes, mime_type
            FROM file_attachments
            WHERE s3_key = $1
            "#,
        )
        .bind(s3_key)
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    pub async fn increment_attachment_download(&self, attachment_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE file_attachments
            SET download_count = download_count + 1,
                last_downloaded_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(attachment_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn is_conversation_member(
        &self,
        conversation_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<bool> {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM conversation_members
                WHERE conversation_id = $1 AND user_id = $2
            )
            "#,
        )
        .bind(conversation_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(exists)
    }

    pub async fn cleanup_expired_attachments(&self) -> Result<Vec<String>> {
        let deleted = sqlx::query_scalar::<_, String>(
            r#"
            DELETE FROM file_attachments
            WHERE expires_at IS NOT NULL AND expires_at < NOW()
            RETURNING s3_key
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(deleted)
    }

    pub async fn cleanup_orphaned_attachments(&self) -> Result<Vec<String>> {
        let deleted = sqlx::query_scalar::<_, String>(
            r#"
            DELETE FROM file_attachments
            WHERE message_id NOT IN (SELECT id FROM messages)
            RETURNING s3_key
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(deleted)
    }
}
