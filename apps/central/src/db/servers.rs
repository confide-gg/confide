use uuid::Uuid;

use crate::error::Result;
use crate::models::UserServers;

use super::Database;

impl Database {
    pub async fn get_user_servers(&self, user_id: Uuid) -> Result<Option<UserServers>> {
        let servers =
            sqlx::query_as::<_, UserServers>("SELECT * FROM user_servers WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(servers)
    }

    pub async fn update_user_servers(
        &self,
        user_id: Uuid,
        encrypted_servers: Vec<u8>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO user_servers (user_id, encrypted_servers, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET encrypted_servers = $2, updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(encrypted_servers)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
