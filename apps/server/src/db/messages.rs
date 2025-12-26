use sqlx::Row;
use uuid::Uuid;

use crate::error::Result;
use crate::models::{Member, Message, Upload};

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

    pub async fn get_channel_messages_with_senders(
        &self,
        channel_id: Uuid,
        limit: i64,
        before: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Vec<(Message, Member)>> {
        let query = if let Some(before_time) = before {
            sqlx::query(
                r#"
                SELECT
                    m.id as msg_id, m.channel_id, m.sender_id, m.encrypted_content,
                    m.signature, m.reply_to_id, m.created_at as msg_created_at,
                    mem.id as mem_id, mem.central_user_id, mem.username, mem.kem_public_key,
                    mem.dsa_public_key, mem.display_name, mem.avatar_url,
                    mem.joined_at
                FROM messages m
                INNER JOIN members mem ON m.sender_id = mem.id
                WHERE m.channel_id = $1 AND m.created_at < $2
                ORDER BY m.created_at DESC
                LIMIT $3
                "#,
            )
            .bind(channel_id)
            .bind(before_time)
            .bind(limit)
        } else {
            sqlx::query(
                r#"
                SELECT
                    m.id as msg_id, m.channel_id, m.sender_id, m.encrypted_content,
                    m.signature, m.reply_to_id, m.created_at as msg_created_at,
                    mem.id as mem_id, mem.central_user_id, mem.username, mem.kem_public_key,
                    mem.dsa_public_key, mem.display_name, mem.avatar_url,
                    mem.joined_at
                FROM messages m
                INNER JOIN members mem ON m.sender_id = mem.id
                WHERE m.channel_id = $1
                ORDER BY m.created_at DESC
                LIMIT $2
                "#,
            )
            .bind(channel_id)
            .bind(limit)
        };

        let rows = query.fetch_all(&self.pool).await?;

        let mut results = Vec::with_capacity(rows.len());
        for row in rows {
            let message = Message {
                id: row.try_get("msg_id")?,
                channel_id: row.try_get("channel_id")?,
                sender_id: row.try_get("sender_id")?,
                encrypted_content: row.try_get("encrypted_content")?,
                signature: row.try_get("signature")?,
                reply_to_id: row.try_get("reply_to_id")?,
                created_at: row.try_get("msg_created_at")?,
            };

            let member = Member {
                id: row.try_get("mem_id")?,
                central_user_id: row.try_get("central_user_id")?,
                username: row.try_get("username")?,
                kem_public_key: row.try_get("kem_public_key")?,
                dsa_public_key: row.try_get("dsa_public_key")?,
                display_name: row.try_get("display_name")?,
                avatar_url: row.try_get("avatar_url")?,
                joined_at: row.try_get("joined_at")?,
            };

            results.push((message, member));
        }

        Ok(results)
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
