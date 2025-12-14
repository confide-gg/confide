mod channels;
mod members;
mod messages;
mod roles;
mod server_identity;
mod sessions;

use redis::Client as RedisClient;
use sqlx::PgPool;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
    #[allow(dead_code)]
    redis: RedisClient,
}

impl Database {
    pub fn new(pool: PgPool, redis: RedisClient) -> Self {
        Self { pool, redis }
    }

    pub async fn delete_all_data(&self) -> crate::error::Result<()> {
        sqlx::query("TRUNCATE TABLE messages, member_roles, roles, sessions, members, categories, channels, bans CASCADE")
            .execute(&self.pool)
            .await?;

        sqlx::query("UPDATE server_identity SET owner_user_id = NULL, setup_token_hash = NULL, password_hash = NULL")
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
