use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{
    Conversation, ConversationMemberWithUser, ConversationRouting, ConversationType,
    ConversationWithRouting,
};

use super::Database;

impl Database {
    pub async fn create_conversation(
        &self,
        conversation_type: ConversationType,
        encrypted_metadata: Option<Vec<u8>>,
        owner_id: Option<Uuid>,
    ) -> Result<Conversation> {
        let conv = sqlx::query_as::<_, Conversation>(
            r#"
            INSERT INTO conversations (conversation_type, encrypted_metadata, owner_id)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(conversation_type.as_str())
        .bind(encrypted_metadata)
        .bind(owner_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(conv)
    }

    pub async fn get_conversation(&self, id: Uuid) -> Result<Option<Conversation>> {
        let conv = sqlx::query_as::<_, Conversation>("SELECT * FROM conversations WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(conv)
    }

    pub async fn add_conversation_member(
        &self,
        conversation_id: Uuid,
        user_id: Uuid,
        encrypted_sender_key: Vec<u8>,
        encrypted_role: Vec<u8>,
    ) -> Result<ConversationRouting> {
        let routing = sqlx::query_as::<_, ConversationRouting>(
            r#"
            INSERT INTO conversation_members (conversation_id, user_id, encrypted_sender_key, encrypted_role)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(conversation_id)
        .bind(user_id)
        .bind(encrypted_sender_key)
        .bind(encrypted_role)
        .fetch_one(&self.pool)
        .await?;

        let cache_key = format!("user:convos:{}", user_id);
        let _ = super::cache::invalidate_cache(&self.redis, &cache_key).await;

        Ok(routing)
    }

    pub async fn get_conversation_routing(
        &self,
        conversation_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<ConversationRouting>> {
        let routing = sqlx::query_as::<_, ConversationRouting>(
            "SELECT * FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
        )
        .bind(conversation_id)
        .bind(user_id)
        .fetch_optional(&self.ws_pool)
        .await?;
        Ok(routing)
    }

    pub async fn get_conversation_members(
        &self,
        conversation_id: Uuid,
    ) -> Result<Vec<ConversationRouting>> {
        let members = sqlx::query_as::<_, ConversationRouting>(
            "SELECT * FROM conversation_members WHERE conversation_id = $1",
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(members)
    }

    pub async fn get_conversation_members_with_users(
        &self,
        conversation_id: Uuid,
    ) -> Result<Vec<ConversationMemberWithUser>> {
        let members = sqlx::query_as::<_, ConversationMemberWithUser>(
            r#"
            SELECT
                cm.conversation_id,
                cm.user_id,
                cm.encrypted_sender_key,
                cm.encrypted_role,
                cm.joined_at,
                u.username,
                u.kem_public_key,
                u.dsa_public_key
            FROM conversation_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.conversation_id = $1
            "#,
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(members)
    }

    pub async fn get_members_for_conversations(
        &self,
        conversation_ids: &[Uuid],
        exclude_user_id: Uuid,
    ) -> Result<Vec<Uuid>> {
        if conversation_ids.is_empty() {
            return Ok(vec![]);
        }

        let user_ids = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT DISTINCT user_id
            FROM conversation_members
            WHERE conversation_id = ANY($1) AND user_id != $2
            "#,
        )
        .bind(conversation_ids)
        .bind(exclude_user_id)
        .fetch_all(&self.ws_pool)
        .await?;

        Ok(user_ids)
    }

    pub async fn get_user_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<ConversationWithRouting>> {
        let cache_key = format!("user:convos:{}", user_id);
        let pool = self.ws_pool.clone();

        super::cache::cached_get(&self.redis, &cache_key, 300, || async move {
            let rows = sqlx::query_as::<_, ConversationWithRouting>(
                r#"
                    SELECT c.id, c.conversation_type, c.encrypted_metadata, c.owner_id, c.created_at,
                           cm.encrypted_sender_key, cm.encrypted_role
                    FROM conversations c
                    JOIN conversation_members cm ON c.id = cm.conversation_id
                    WHERE cm.user_id = $1 AND cm.hidden = FALSE
                    ORDER BY c.created_at DESC
                    "#,
            )
            .bind(user_id)
            .fetch_all(&pool)
            .await?;
            Ok(rows)
        })
        .await
        .map_err(AppError::Internal)
    }

    pub async fn hide_conversation(&self, conversation_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE conversation_members SET hidden = TRUE WHERE conversation_id = $1 AND user_id = $2",
        )
        .bind(conversation_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        let cache_key = format!("user:convos:{}", user_id);
        let _ = super::cache::invalidate_cache(&self.redis, &cache_key).await;

        Ok(())
    }

    pub async fn unhide_conversation(&self, conversation_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE conversation_members SET hidden = FALSE WHERE conversation_id = $1 AND user_id = $2",
        )
        .bind(conversation_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        let cache_key = format!("user:convos:{}", user_id);
        let _ = super::cache::invalidate_cache(&self.redis, &cache_key).await;

        Ok(())
    }

    pub async fn remove_conversation_member(
        &self,
        conversation_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        sqlx::query("DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2")
            .bind(conversation_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        let cache_key = format!("user:convos:{}", user_id);
        let _ = super::cache::invalidate_cache(&self.redis, &cache_key).await;

        Ok(())
    }

    pub async fn update_conversation_metadata(
        &self,
        conversation_id: Uuid,
        encrypted_metadata: Option<Vec<u8>>,
    ) -> Result<()> {
        sqlx::query("UPDATE conversations SET encrypted_metadata = $1 WHERE id = $2")
            .bind(encrypted_metadata)
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn update_conversation_owner(
        &self,
        conversation_id: Uuid,
        owner_id: Option<Uuid>,
    ) -> Result<()> {
        sqlx::query("UPDATE conversations SET owner_id = $1 WHERE id = $2")
            .bind(owner_id)
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_conversation(&self, conversation_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM conversations WHERE id = $1")
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn add_group_event(
        &self,
        conversation_id: Uuid,
        event_type: &str,
        actor_id: Option<Uuid>,
        target_user_id: Option<Uuid>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO group_events (conversation_id, event_type, actor_id, target_user_id)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(conversation_id)
        .bind(event_type)
        .bind(actor_id)
        .bind(target_user_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn find_dm_conversation(
        &self,
        user1: Uuid,
        user2: Uuid,
    ) -> Result<Option<Conversation>> {
        let conv = sqlx::query_as::<_, Conversation>(
            r#"
            SELECT c.* FROM conversations c
            WHERE c.conversation_type = 'dm'
            AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $1)
            AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2)
            AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
            "#,
        )
        .bind(user1)
        .bind(user2)
        .fetch_optional(&self.pool)
        .await?;
        Ok(conv)
    }
}
