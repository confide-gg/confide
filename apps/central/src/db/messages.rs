use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use crate::error::Result;
use crate::models::{Message, MessageKey, MessageReaction, MessageRow};

use super::Database;

impl Database {
    #[allow(clippy::too_many_arguments)]
    pub async fn create_message(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        encrypted_content: Vec<u8>,
        signature: Vec<u8>,
        reply_to_id: Option<Uuid>,
        expires_at: Option<DateTime<Utc>>,
        sender_chain_id: Option<i32>,
        sender_chain_iteration: Option<i32>,
    ) -> Result<Message> {
        let row = sqlx::query_as::<_, MessageRow>(
            r#"
            INSERT INTO messages (conversation_id, sender_id, encrypted_content, signature, reply_to_id, expires_at, sender_chain_id, sender_chain_iteration)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(conversation_id)
        .bind(sender_id)
        .bind(encrypted_content)
        .bind(signature)
        .bind(reply_to_id)
        .bind(expires_at)
        .bind(sender_chain_id)
        .bind(sender_chain_iteration)
        .fetch_one(&self.pool)
        .await?;

        Ok(Message {
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            encrypted_content: row.encrypted_content,
            signature: row.signature,
            reply_to_id: row.reply_to_id,
            expires_at: row.expires_at,
            sender_chain_id: row.sender_chain_id,
            sender_chain_iteration: row.sender_chain_iteration,
            edited_at: row.edited_at,
            message_type: row.message_type,
            call_id: row.call_id,
            call_duration_seconds: row.call_duration_seconds,
            pinned_at: row.pinned_at,
            reactions: vec![],
            created_at: row.created_at,
        })
    }

    pub async fn create_call_event_message(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        message_type: &str,
        call_id: Uuid,
        call_duration_seconds: Option<i32>,
    ) -> Result<Message> {
        let row = sqlx::query_as::<_, MessageRow>(
            r#"
            INSERT INTO messages (conversation_id, sender_id, encrypted_content, signature, message_type, call_id, call_duration_seconds)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(conversation_id)
        .bind(sender_id)
        .bind(Vec::<u8>::new())
        .bind(Vec::<u8>::new())
        .bind(message_type)
        .bind(call_id)
        .bind(call_duration_seconds)
        .fetch_one(&self.pool)
        .await?;

        Ok(Message {
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            encrypted_content: row.encrypted_content,
            signature: row.signature,
            reply_to_id: row.reply_to_id,
            expires_at: row.expires_at,
            sender_chain_id: row.sender_chain_id,
            sender_chain_iteration: row.sender_chain_iteration,
            edited_at: row.edited_at,
            message_type: row.message_type,
            call_id: row.call_id,
            call_duration_seconds: row.call_duration_seconds,
            pinned_at: row.pinned_at,
            reactions: vec![],
            created_at: row.created_at,
        })
    }

    pub async fn create_system_message(
        &self,
        conversation_id: Uuid,
        sender_id: Uuid,
        message_type: &str,
        reply_to_id: Option<Uuid>,
    ) -> Result<Message> {
        let row = sqlx::query_as::<_, MessageRow>(
            r#"
            INSERT INTO messages (conversation_id, sender_id, encrypted_content, signature, message_type, reply_to_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(conversation_id)
        .bind(sender_id)
        .bind(Vec::<u8>::new())
        .bind(Vec::<u8>::new())
        .bind(message_type)
        .bind(reply_to_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(Message {
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            encrypted_content: row.encrypted_content,
            signature: row.signature,
            reply_to_id: row.reply_to_id,
            expires_at: row.expires_at,
            sender_chain_id: row.sender_chain_id,
            sender_chain_iteration: row.sender_chain_iteration,
            edited_at: row.edited_at,
            message_type: row.message_type,
            call_id: row.call_id,
            call_duration_seconds: row.call_duration_seconds,
            pinned_at: row.pinned_at,
            reactions: vec![],
            created_at: row.created_at,
        })
    }

    pub async fn has_call_message(&self, call_id: Uuid, message_type: &str) -> Result<bool> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM messages WHERE call_id = $1 AND message_type = $2",
        )
        .bind(call_id)
        .bind(message_type)
        .fetch_one(&self.pool)
        .await?;
        Ok(count > 0)
    }

    pub async fn get_messages(
        &self,
        conversation_id: Uuid,
        limit: i64,
        before: Option<Uuid>,
    ) -> Result<Vec<Message>> {
        let rows = if let Some(before_id) = before {
            sqlx::query_as::<_, MessageRow>(
                r#"
                SELECT * FROM messages
                WHERE conversation_id = $1
                AND (expires_at IS NULL OR expires_at > NOW())
                AND created_at < (SELECT created_at FROM messages WHERE id = $2)
                ORDER BY created_at DESC
                LIMIT $3
                "#,
            )
            .bind(conversation_id)
            .bind(before_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, MessageRow>(
                r#"
                SELECT * FROM messages
                WHERE conversation_id = $1
                AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY created_at DESC
                LIMIT $2
                "#,
            )
            .bind(conversation_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        };

        let message_ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
        let reactions = self.get_reactions_for_messages(&message_ids).await?;

        let messages = rows
            .into_iter()
            .map(|row| {
                let msg_reactions: Vec<MessageReaction> = reactions
                    .iter()
                    .filter(|r| r.message_id == row.id)
                    .cloned()
                    .collect();
                Message {
                    id: row.id,
                    conversation_id: row.conversation_id,
                    sender_id: row.sender_id,
                    encrypted_content: row.encrypted_content,
                    signature: row.signature,
                    reply_to_id: row.reply_to_id,
                    expires_at: row.expires_at,
                    sender_chain_id: row.sender_chain_id,
                    sender_chain_iteration: row.sender_chain_iteration,
                    edited_at: row.edited_at,
                    message_type: row.message_type,
                    call_id: row.call_id,
                    call_duration_seconds: row.call_duration_seconds,
                    pinned_at: row.pinned_at,
                    reactions: msg_reactions,
                    created_at: row.created_at,
                }
            })
            .collect();

        Ok(messages)
    }

    pub async fn get_message(&self, message_id: Uuid) -> Result<Option<MessageRow>> {
        let row = sqlx::query_as::<_, MessageRow>("SELECT * FROM messages WHERE id = $1")
            .bind(message_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    pub async fn delete_message(&self, message_id: Uuid, sender_id: Uuid) -> Result<bool> {
        let result = sqlx::query("DELETE FROM messages WHERE id = $1 AND sender_id = $2")
            .bind(message_id)
            .bind(sender_id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn update_message(
        &self,
        message_id: Uuid,
        sender_id: Uuid,
        encrypted_content: Vec<u8>,
        signature: Vec<u8>,
    ) -> Result<Option<DateTime<Utc>>> {
        let edited_at = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE messages
            SET encrypted_content = $1, signature = $2, edited_at = $3
            WHERE id = $4 AND sender_id = $5
            "#,
        )
        .bind(&encrypted_content)
        .bind(&signature)
        .bind(edited_at)
        .bind(message_id)
        .bind(sender_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() > 0 {
            Ok(Some(edited_at))
        } else {
            Ok(None)
        }
    }

    pub async fn get_reactions_for_messages(
        &self,
        message_ids: &[Uuid],
    ) -> Result<Vec<MessageReaction>> {
        if message_ids.is_empty() {
            return Ok(vec![]);
        }
        let reactions = sqlx::query_as::<_, MessageReaction>(
            r#"
            SELECT * FROM message_reactions
            WHERE message_id = ANY($1)
            ORDER BY created_at ASC
            "#,
        )
        .bind(message_ids)
        .fetch_all(&self.pool)
        .await?;
        Ok(reactions)
    }

    pub async fn add_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<MessageReaction> {
        let reaction = sqlx::query_as::<_, MessageReaction>(
            r#"
            INSERT INTO message_reactions (message_id, user_id, emoji)
            VALUES ($1, $2, $3)
            ON CONFLICT (message_id, user_id, emoji) DO UPDATE SET emoji = EXCLUDED.emoji
            RETURNING *
            "#,
        )
        .bind(message_id)
        .bind(user_id)
        .bind(emoji)
        .fetch_one(&self.pool)
        .await?;
        Ok(reaction)
    }

    pub async fn remove_reaction(
        &self,
        message_id: Uuid,
        user_id: Uuid,
        emoji: &str,
    ) -> Result<bool> {
        let result = sqlx::query(
            "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
        )
        .bind(message_id)
        .bind(user_id)
        .bind(emoji)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete_old_messages(&self, ttl_days: u32) -> Result<u64> {
        let cutoff = Utc::now() - Duration::days(ttl_days as i64);
        let result = sqlx::query("DELETE FROM messages WHERE created_at < $1")
            .bind(cutoff)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_expired_messages(&self) -> Result<u64> {
        let result =
            sqlx::query("DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < NOW()")
                .execute(&self.pool)
                .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_expired_sessions(&self) -> Result<u64> {
        let result = sqlx::query("DELETE FROM sessions WHERE expires_at < NOW()")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn store_message_keys(
        &self,
        message_id: Uuid,
        keys: &[(Uuid, Vec<u8>)],
    ) -> Result<()> {
        if keys.is_empty() {
            return Ok(());
        }

        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO message_keys (message_id, user_id, encrypted_key) ",
        );

        query_builder.push_values(keys, |mut b, (user_id, encrypted_key)| {
            b.push_bind(message_id)
                .push_bind(user_id)
                .push_bind(encrypted_key);
        });

        query_builder.push(
            " ON CONFLICT (message_id, user_id) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key"
        );

        query_builder.build().execute(&self.pool).await?;

        Ok(())
    }

    pub async fn get_message_key(
        &self,
        message_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<MessageKey>> {
        let key = sqlx::query_as::<_, MessageKey>(
            "SELECT * FROM message_keys WHERE message_id = $1 AND user_id = $2",
        )
        .bind(message_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(key)
    }

    pub async fn get_message_keys_for_user(
        &self,
        message_ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<MessageKey>> {
        if message_ids.is_empty() {
            return Ok(vec![]);
        }
        let keys = sqlx::query_as::<_, MessageKey>(
            r#"
            SELECT * FROM message_keys
            WHERE message_id = ANY($1) AND user_id = $2
            "#,
        )
        .bind(message_ids)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(keys)
    }

    pub async fn pin_message(&self, message_id: Uuid) -> Result<DateTime<Utc>> {
        let pinned_at = Utc::now();
        sqlx::query(
            r#"
            UPDATE messages
            SET pinned_at = $1
            WHERE id = $2
            "#,
        )
        .bind(pinned_at)
        .bind(message_id)
        .execute(&self.pool)
        .await?;
        Ok(pinned_at)
    }

    pub async fn unpin_message(&self, message_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE messages
            SET pinned_at = NULL
            WHERE id = $1
            "#,
        )
        .bind(message_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_pinned_messages(&self, conversation_id: Uuid) -> Result<Vec<Message>> {
        let rows = sqlx::query_as::<_, MessageRow>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1 AND pinned_at IS NOT NULL
            ORDER BY pinned_at DESC
            "#,
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;

        let message_ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
        let reactions = self.get_reactions_for_messages(&message_ids).await?;

        let messages = rows
            .into_iter()
            .map(|row| {
                let msg_reactions: Vec<MessageReaction> = reactions
                    .iter()
                    .filter(|r| r.message_id == row.id)
                    .cloned()
                    .collect();
                Message {
                    id: row.id,
                    conversation_id: row.conversation_id,
                    sender_id: row.sender_id,
                    encrypted_content: row.encrypted_content,
                    signature: row.signature,
                    reply_to_id: row.reply_to_id,
                    expires_at: row.expires_at,
                    sender_chain_id: row.sender_chain_id,
                    sender_chain_iteration: row.sender_chain_iteration,
                    edited_at: row.edited_at,
                    message_type: row.message_type,
                    call_id: row.call_id,
                    call_duration_seconds: row.call_duration_seconds,
                    pinned_at: row.pinned_at,
                    reactions: msg_reactions,
                    created_at: row.created_at,
                }
            })
            .collect();

        Ok(messages)
    }
}
