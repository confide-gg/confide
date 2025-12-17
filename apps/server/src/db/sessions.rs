use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::error::Result;
use crate::models::Session;

use super::Database;

impl Database {
    pub async fn create_session(
        &self,
        member_id: Uuid,
        token_hash: Vec<u8>,
        expires_at: DateTime<Utc>,
    ) -> Result<Session> {
        let session = sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO sessions (member_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(member_id)
        .bind(&token_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;

        let cache_key = format!("session:{}", hex::encode(&token_hash));
        let serialized = serde_json::to_string(&session)
            .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
        let mut conn = self.redis_conn().await?;
        let _: () = redis::AsyncCommands::set_ex(&mut conn, &cache_key, serialized, 3600).await?;

        Ok(session)
    }

    async fn get_session_by_token_uncached(&self, token_hash: &[u8]) -> Result<Option<Session>> {
        let session = sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE token_hash = $1")
            .bind(token_hash)
            .fetch_optional(&self.pool)
            .await?;
        Ok(session)
    }

    pub async fn get_session_by_token(&self, token_hash: &[u8]) -> Result<Option<Session>> {
        use crate::db::cache::cached_get_optional;

        let cache_key = format!("session:{}", hex::encode(token_hash));

        let db = self.clone();
        let token_hash_owned = token_hash.to_vec();
        let result = cached_get_optional(self.redis_client(), &cache_key, 3600, || async move {
            db.get_session_by_token_uncached(&token_hash_owned)
                .await
                .map_err(|e| anyhow::anyhow!("{:?}", e))
        })
        .await
        .map_err(|e| e.into());

        result
    }

    pub async fn delete_session(&self, session_id: Uuid) -> Result<()> {
        let session = sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = $1")
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await?;

        sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(session_id)
            .execute(&self.pool)
            .await?;

        if let Some(sess) = session {
            let cache_key = format!("session:{}", hex::encode(&sess.token_hash));
            let mut conn = self.redis_conn().await?;
            let _: () = redis::cmd("DEL")
                .arg(&cache_key)
                .query_async(&mut conn)
                .await?;
        }

        Ok(())
    }

    pub async fn delete_member_sessions(&self, member_id: Uuid) -> Result<()> {
        let sessions: Vec<Session> = sqlx::query_as("SELECT * FROM sessions WHERE member_id = $1")
            .bind(member_id)
            .fetch_all(&self.pool)
            .await?;

        sqlx::query("DELETE FROM sessions WHERE member_id = $1")
            .bind(member_id)
            .execute(&self.pool)
            .await?;

        for session in sessions {
            let cache_key = format!("session:{}", hex::encode(&session.token_hash));
            let mut conn = self.redis_conn().await?;
            let _: () = redis::cmd("DEL")
                .arg(&cache_key)
                .query_async(&mut conn)
                .await?;
        }

        Ok(())
    }

    pub async fn delete_expired_sessions(&self) -> Result<u64> {
        use crate::db::cache::invalidate_cache_pattern;

        let result = sqlx::query("DELETE FROM sessions WHERE expires_at <= NOW()")
            .execute(&self.pool)
            .await?;

        invalidate_cache_pattern(self.redis_client(), "session:*").await?;

        Ok(result.rows_affected())
    }
}
