use uuid::Uuid;

use crate::error::Result;
use crate::models::ServerIdentity;

use super::Database;

impl Database {
    pub async fn get_server_identity(&self) -> Result<Option<ServerIdentity>> {
        let identity = sqlx::query_as::<_, ServerIdentity>("SELECT * FROM server_identity LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;
        Ok(identity)
    }

    pub async fn create_server_identity(
        &self,
        server_name: String,
        description: Option<String>,
        is_discoverable: bool,
        dsa_public_key: Vec<u8>,
        dsa_private_key_encrypted: Vec<u8>,
        setup_token_hash: Vec<u8>,
    ) -> Result<ServerIdentity> {
        let identity = sqlx::query_as::<_, ServerIdentity>(
            r#"
            INSERT INTO server_identity (
                server_name, description, is_discoverable, 
                max_users, max_upload_size_mb, message_retention,
                dsa_public_key, dsa_private_key_encrypted, setup_token_hash
            )
            VALUES ($1, $2, $3, 100, 100, '30d', $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(server_name)
        .bind(description)
        .bind(is_discoverable)
        .bind(dsa_public_key)
        .bind(dsa_private_key_encrypted)
        .bind(setup_token_hash)
        .fetch_one(&self.pool)
        .await?;
        Ok(identity)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update_server_settings(
        &self,
        server_name: Option<String>,
        description: Option<Option<String>>,
        is_discoverable: Option<bool>,
        icon_url: Option<Option<String>>,
        max_users: Option<i32>,
        max_upload_size_mb: Option<i32>,
        message_retention: Option<String>,
    ) -> Result<ServerIdentity> {
        // Build dynamic update query
        let mut query = "UPDATE server_identity SET ".to_string();
        let mut updates = Vec::new();
        let mut bind_count = 1;

        if server_name.is_some() {
            updates.push(format!("server_name = ${}", bind_count));
            bind_count += 1;
        }
        if description.is_some() {
            updates.push(format!("description = ${}", bind_count));
            bind_count += 1;
        }
        if is_discoverable.is_some() {
            updates.push(format!("is_discoverable = ${}", bind_count));
            bind_count += 1;
        }
        if icon_url.is_some() {
            updates.push(format!("icon_url = ${}", bind_count));
            bind_count += 1;
        }
        if max_users.is_some() {
            updates.push(format!("max_users = ${}", bind_count));
            bind_count += 1;
        }
        if max_upload_size_mb.is_some() {
            updates.push(format!("max_upload_size_mb = ${}", bind_count));
            bind_count += 1;
        }
        if message_retention.is_some() {
            updates.push(format!("message_retention = ${}", bind_count));
            // bind_count += 1;
        }

        if updates.is_empty() {
            return self.get_server_identity().await?.ok_or_else(|| {
                crate::error::AppError::Internal("Server identity not found".into())
            });
        }

        query.push_str(&updates.join(", "));
        query.push_str(" RETURNING *");

        let mut q = sqlx::query_as::<_, ServerIdentity>(&query);

        if let Some(name) = server_name {
            q = q.bind(name);
        }
        if let Some(desc) = description {
            q = q.bind(desc);
        }
        if let Some(disc) = is_discoverable {
            q = q.bind(disc);
        }
        if let Some(icon) = icon_url {
            q = q.bind(icon);
        }
        if let Some(users) = max_users {
            q = q.bind(users);
        }
        if let Some(size) = max_upload_size_mb {
            q = q.bind(size);
        }
        if let Some(retention) = message_retention {
            q = q.bind(retention);
        }

        let identity = q.fetch_one(&self.pool).await?;
        Ok(identity)
    }

    pub async fn set_server_owner(
        &self,
        owner_user_id: Uuid,
        central_registration_id: Option<Uuid>,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE server_identity SET owner_user_id = $1, central_registration_id = $2, setup_token_hash = NULL",
        )
        .bind(owner_user_id)
        .bind(central_registration_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_central_registration(&self, central_registration_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE server_identity SET central_registration_id = $1")
            .bind(central_registration_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn is_setup_complete(&self) -> Result<bool> {
        let identity = self.get_server_identity().await?;
        Ok(identity.map(|i| i.owner_user_id.is_some()).unwrap_or(false))
    }

    pub async fn set_server_password(&self, password_hash: Option<String>) -> Result<()> {
        sqlx::query("UPDATE server_identity SET password_hash = $1")
            .bind(password_hash)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_server_password_hash(&self) -> Result<Option<String>> {
        let identity = self.get_server_identity().await?;
        Ok(identity.and_then(|i| i.password_hash))
    }

    pub async fn has_password(&self) -> Result<bool> {
        let hash = self.get_server_password_hash().await?;
        Ok(hash.is_some())
    }
}
