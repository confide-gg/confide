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
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;
        Ok(session)
    }

    pub async fn get_session_by_token(&self, token_hash: &[u8]) -> Result<Option<Session>> {
        let session = sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE token_hash = $1")
            .bind(token_hash)
            .fetch_optional(&self.pool)
            .await?;
        Ok(session)
    }

    pub async fn delete_session(&self, session_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(session_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_member_sessions(&self, member_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE member_id = $1")
            .bind(member_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_expired_sessions(&self) -> Result<u64> {
        let result = sqlx::query("DELETE FROM sessions WHERE expires_at <= NOW()")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
