use uuid::Uuid;

use crate::error::Result;
use crate::models::{Message, Upload};

use super::Database;

impl Database {
    pub async fn create_message(
        &self,
        channel_id: Uuid,
        sender_id: Uuid,
        encrypted_content: Vec<u8>,
        signature: Vec<u8>,
        reply_to_id: Option<Uuid>,
    ) -> Result<Message> {
        let message = sqlx::query_as::<_, Message>(
            r#"
            INSERT INTO messages (channel_id, sender_id, encrypted_content, signature, reply_to_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(channel_id)
        .bind(sender_id)
        .bind(encrypted_content)
        .bind(signature)
        .bind(reply_to_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(message)
    }

    pub async fn get_message(&self, message_id: Uuid) -> Result<Option<Message>> {
        let message = sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = $1")
            .bind(message_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(message)
    }

    pub async fn get_channel_messages(
        &self,
        channel_id: Uuid,
        limit: i64,
        before: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Vec<Message>> {
        let messages = if let Some(before_time) = before {
            sqlx::query_as::<_, Message>(
                r#"
                SELECT * FROM messages
                WHERE channel_id = $1 AND created_at < $2
                ORDER BY created_at DESC
                LIMIT $3
                "#,
            )
            .bind(channel_id)
            .bind(before_time)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Message>(
                r#"
                SELECT * FROM messages
                WHERE channel_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                "#,
            )
            .bind(channel_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        };
        Ok(messages)
    }

    pub async fn delete_message(&self, message_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM messages WHERE id = $1")
            .bind(message_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn create_upload(
        &self,
        uploader_id: Uuid,
        filename: String,
        content_type: String,
        file_size: i64,
        storage_path: String,
    ) -> Result<Upload> {
        let upload = sqlx::query_as::<_, Upload>(
            r#"
            INSERT INTO uploads (uploader_id, filename, content_type, file_size, storage_path)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(uploader_id)
        .bind(filename)
        .bind(content_type)
        .bind(file_size)
        .bind(storage_path)
        .fetch_one(&self.pool)
        .await?;
        Ok(upload)
    }

    pub async fn get_upload(&self, upload_id: Uuid) -> Result<Option<Upload>> {
        let upload = sqlx::query_as::<_, Upload>("SELECT * FROM uploads WHERE id = $1")
            .bind(upload_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(upload)
    }

    pub async fn delete_upload(&self, upload_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM uploads WHERE id = $1")
            .bind(upload_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
