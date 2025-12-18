use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::error::Result;
use crate::models::{FederationToken, RegisteredServer};

use super::Database;

impl Database {
    pub async fn register_server(
        &self,
        dsa_public_key: Vec<u8>,
        domain: String,
        display_name: String,
        description: Option<String>,
        owner_id: Option<Uuid>,
        is_discoverable: bool,
    ) -> Result<RegisteredServer> {
        let server = sqlx::query_as::<_, RegisteredServer>(
            r#"
            INSERT INTO registered_servers (dsa_public_key, domain, display_name, description, owner_id, is_discoverable, last_heartbeat)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
            "#,
        )
        .bind(dsa_public_key)
        .bind(domain)
        .bind(display_name)
        .bind(description)
        .bind(owner_id)
        .bind(is_discoverable)
        .fetch_one(&self.pool)
        .await?;
        Ok(server)
    }

    pub async fn get_registered_server(&self, server_id: Uuid) -> Result<Option<RegisteredServer>> {
        let server =
            sqlx::query_as::<_, RegisteredServer>("SELECT * FROM registered_servers WHERE id = $1")
                .bind(server_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(server)
    }

    pub async fn get_server_by_public_key(
        &self,
        dsa_public_key: &[u8],
    ) -> Result<Option<RegisteredServer>> {
        let server = sqlx::query_as::<_, RegisteredServer>(
            "SELECT * FROM registered_servers WHERE dsa_public_key = $1",
        )
        .bind(dsa_public_key)
        .fetch_optional(&self.pool)
        .await?;
        Ok(server)
    }

    pub async fn get_server_by_domain(&self, domain: &str) -> Result<Option<RegisteredServer>> {
        let server = sqlx::query_as::<_, RegisteredServer>(
            "SELECT * FROM registered_servers WHERE domain = $1",
        )
        .bind(domain)
        .fetch_optional(&self.pool)
        .await?;
        Ok(server)
    }

    pub async fn update_server_heartbeat(&self, server_id: Uuid, member_count: i32) -> Result<()> {
        sqlx::query(
            "UPDATE registered_servers SET last_heartbeat = NOW(), member_count = $2 WHERE id = $1",
        )
        .bind(server_id)
        .bind(member_count)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_server_info(
        &self,
        server_id: Uuid,
        display_name: Option<String>,
        description: Option<String>,
        icon_url: Option<String>,
        is_discoverable: Option<bool>,
    ) -> Result<()> {
        let mut query = String::from("UPDATE registered_servers SET ");
        let mut params: Vec<String> = vec![];
        let mut param_count = 1;

        if display_name.is_some() {
            params.push(format!("display_name = ${}", param_count));
            param_count += 1;
        }
        if description.is_some() {
            params.push(format!("description = ${}", param_count));
            param_count += 1;
        }
        if icon_url.is_some() {
            params.push(format!("icon_url = ${}", param_count));
            param_count += 1;
        }
        if is_discoverable.is_some() {
            params.push(format!("is_discoverable = ${}", param_count));
            param_count += 1;
        }

        if params.is_empty() {
            return Ok(());
        }

        query.push_str(&params.join(", "));
        query.push_str(&format!(" WHERE id = ${}", param_count));

        let mut q = sqlx::query(&query);

        if let Some(name) = display_name {
            q = q.bind(name);
        }
        if let Some(desc) = description {
            q = q.bind(desc);
        }
        if let Some(icon) = icon_url {
            q = q.bind(icon);
        }
        if let Some(disc) = is_discoverable {
            q = q.bind(disc);
        }

        q = q.bind(server_id);
        q.execute(&self.pool).await?;

        Ok(())
    }

    pub async fn delete_registered_server(&self, server_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM registered_servers WHERE id = $1")
            .bind(server_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_user_owned_servers(&self, owner_id: Uuid) -> Result<Vec<RegisteredServer>> {
        let servers = sqlx::query_as::<_, RegisteredServer>(
            "SELECT * FROM registered_servers WHERE owner_id = $1 ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(servers)
    }

    pub async fn create_federation_token(
        &self,
        user_id: Uuid,
        server_id: Uuid,
        token_hash: Vec<u8>,
        expires_at: DateTime<Utc>,
    ) -> Result<FederationToken> {
        let token = sqlx::query_as::<_, FederationToken>(
            r#"
            INSERT INTO federation_tokens (user_id, server_id, token_hash, expires_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, server_id) DO UPDATE SET
                token_hash = EXCLUDED.token_hash,
                expires_at = EXCLUDED.expires_at
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;
        Ok(token)
    }

    pub async fn get_federation_token(&self, token_hash: &[u8]) -> Result<Option<FederationToken>> {
        let token = sqlx::query_as::<_, FederationToken>(
            "SELECT * FROM federation_tokens WHERE token_hash = $1 AND expires_at > NOW()",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await?;
        Ok(token)
    }

    pub async fn verify_federation_token(
        &self,
        server_id: Uuid,
        token_hash: &[u8],
        user_id: Uuid,
    ) -> Result<bool> {
        let exists: (bool,) = sqlx::query_as(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM federation_tokens
                WHERE server_id = $1 AND token_hash = $2 AND user_id = $3 AND expires_at > NOW()
            )
            "#,
        )
        .bind(server_id)
        .bind(token_hash)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(exists.0)
    }

    pub async fn delete_expired_federation_tokens(&self) -> Result<u64> {
        let result = sqlx::query("DELETE FROM federation_tokens WHERE expires_at <= NOW()")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_user_federation_tokens(&self, user_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM federation_tokens WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn validate_and_store_heartbeat_nonce(
        &self,
        nonce: Uuid,
        server_id: Uuid,
    ) -> Result<bool> {
        let result = sqlx::query(
            r#"
            INSERT INTO heartbeat_nonces (nonce, server_id)
            VALUES ($1, $2)
            ON CONFLICT (nonce) DO NOTHING
            RETURNING nonce
            "#,
        )
        .bind(nonce)
        .bind(server_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.is_some())
    }

    pub async fn cleanup_expired_heartbeat_nonces(&self) -> Result<u64> {
        let result = sqlx::query(
            "DELETE FROM heartbeat_nonces WHERE received_at < NOW() - INTERVAL '10 minutes'",
        )
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }
}
