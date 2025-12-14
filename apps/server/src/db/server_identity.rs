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
        dsa_public_key: Vec<u8>,
        dsa_private_key_encrypted: Vec<u8>,
        setup_token_hash: Vec<u8>,
    ) -> Result<ServerIdentity> {
        let identity = sqlx::query_as::<_, ServerIdentity>(
            r#"
            INSERT INTO server_identity (server_name, dsa_public_key, dsa_private_key_encrypted, setup_token_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(server_name)
        .bind(dsa_public_key)
        .bind(dsa_private_key_encrypted)
        .bind(setup_token_hash)
        .fetch_one(&self.pool)
        .await?;
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
