use chrono::{Duration, Utc};
use sqlx::Row;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{PublicUser, RecoveryKeys, Session, User, UserKeys};

use super::{cache, Database};

impl Database {
    pub async fn create_user(
        &self,
        username: &str,
        password_hash: Vec<u8>,
        keys: UserKeys,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, password_hash, kem_public_key, kem_encrypted_private,
                              dsa_public_key, dsa_encrypted_private, key_salt)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(username)
        .bind(password_hash)
        .bind(&keys.kem_public_key)
        .bind(&keys.kem_encrypted_private)
        .bind(&keys.dsa_public_key)
        .bind(&keys.dsa_encrypted_private)
        .bind(&keys.key_salt)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(ref db_err)
                if db_err.constraint() == Some("users_username_key") =>
            {
                AppError::UserAlreadyExists
            }
            _ => AppError::Database(e),
        })?;

        sqlx::query("INSERT INTO user_friends (user_id, encrypted_friends) VALUES ($1, $2)")
            .bind(user.id)
            .bind(Vec::<u8>::new())
            .execute(&self.pool)
            .await?;

        Ok(user)
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn get_user_by_id(&self, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn get_users_by_ids(&self, ids: &[Uuid]) -> Result<Vec<User>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let users = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ANY($1)")
            .bind(ids)
            .fetch_all(&self.pool)
            .await?;
        Ok(users)
    }

    pub async fn get_public_user(&self, id: Uuid) -> Result<Option<PublicUser>> {
        let cache_key = format!("user:public:{}", id);
        let pool = self.pool.clone();

        cache::cached_get_optional(&self.redis, &cache_key, 3600, || async move {
            let row = sqlx::query(
                "SELECT id, username, kem_public_key, dsa_public_key FROM users WHERE id = $1",
            )
            .bind(id)
            .fetch_optional(&pool)
            .await?;

            Ok(row.map(|r| PublicUser {
                id: r.get("id"),
                username: r.get("username"),
                kem_public_key: r.get("kem_public_key"),
                dsa_public_key: r.get("dsa_public_key"),
            }))
        })
        .await
        .map_err(AppError::Internal)
    }

    pub async fn search_users(&self, query: &str, limit: i64) -> Result<Vec<PublicUser>> {
        let rows = sqlx::query(
            r#"
            SELECT id, username, kem_public_key, dsa_public_key
            FROM users
            WHERE username = $1
            LIMIT $2
            "#,
        )
        .bind(query)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| PublicUser {
                id: r.get("id"),
                username: r.get("username"),
                kem_public_key: r.get("kem_public_key"),
                dsa_public_key: r.get("dsa_public_key"),
            })
            .collect())
    }

    pub async fn create_session(
        &self,
        user_id: Uuid,
        token_hash: Vec<u8>,
        expiry_hours: u64,
    ) -> Result<Session> {
        let expires_at = Utc::now() + Duration::hours(expiry_hours as i64);
        let session = sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO sessions (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;
        Ok(session)
    }

    pub async fn get_session_by_token_hash(&self, token_hash: &[u8]) -> Result<Option<Session>> {
        let token_hash_hex = hex::encode(&token_hash[..8.min(token_hash.len())]);
        let cache_key = format!("session:{}", token_hash_hex);
        let pool = self.pool.clone();
        let token_hash_vec = token_hash.to_vec();

        cache::cached_get_optional(&self.redis, &cache_key, 60, || async move {
            let session = sqlx::query_as::<_, Session>(
                "SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()",
            )
            .bind(token_hash_vec)
            .fetch_optional(&pool)
            .await?;
            Ok(session)
        })
        .await
        .map_err(AppError::Internal)
    }

    pub async fn delete_session(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        cache::invalidate_cache_pattern(&self.redis, "session:*")
            .await
            .ok();
        Ok(())
    }

    pub async fn delete_user_sessions(&self, user_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn setup_recovery(&self, user_id: Uuid, recovery_keys: RecoveryKeys) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users SET
                recovery_kem_encrypted_private = $1,
                recovery_dsa_encrypted_private = $2,
                recovery_key_salt = $3,
                recovery_setup_completed = TRUE
            WHERE id = $4
            "#,
        )
        .bind(&recovery_keys.recovery_kem_encrypted_private)
        .bind(&recovery_keys.recovery_dsa_encrypted_private)
        .bind(&recovery_keys.recovery_key_salt)
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_recovery_status(&self, user_id: Uuid) -> Result<bool> {
        let row = sqlx::query("SELECT recovery_setup_completed FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;
        Ok(row.get("recovery_setup_completed"))
    }

    pub async fn get_recovery_data(
        &self,
        username: &str,
    ) -> Result<Option<(Uuid, Vec<u8>, Vec<u8>, Vec<u8>)>> {
        let row = sqlx::query(
            r#"
            SELECT id, recovery_kem_encrypted_private, recovery_dsa_encrypted_private, recovery_key_salt
            FROM users
            WHERE username = $1 AND recovery_setup_completed = TRUE
            "#,
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| {
            (
                r.get("id"),
                r.get("recovery_kem_encrypted_private"),
                r.get("recovery_dsa_encrypted_private"),
                r.get("recovery_key_salt"),
            )
        }))
    }

    pub async fn reset_password_with_recovery(
        &self,
        user_id: Uuid,
        new_password_hash: Vec<u8>,
        new_keys: UserKeys,
        new_recovery_keys: RecoveryKeys,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users SET
                password_hash = $1,
                kem_encrypted_private = $2,
                dsa_encrypted_private = $3,
                key_salt = $4,
                recovery_kem_encrypted_private = $5,
                recovery_dsa_encrypted_private = $6,
                recovery_key_salt = $7
            WHERE id = $8
            "#,
        )
        .bind(&new_password_hash)
        .bind(&new_keys.kem_encrypted_private)
        .bind(&new_keys.dsa_encrypted_private)
        .bind(&new_keys.key_salt)
        .bind(&new_recovery_keys.recovery_kem_encrypted_private)
        .bind(&new_recovery_keys.recovery_dsa_encrypted_private)
        .bind(&new_recovery_keys.recovery_key_salt)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        self.delete_user_sessions(user_id).await?;

        Ok(())
    }
}
