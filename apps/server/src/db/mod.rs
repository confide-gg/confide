pub mod cache;
pub mod cache_lock;
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
    redis: RedisClient,
}

impl Database {
    pub fn new(pool: PgPool, redis: RedisClient) -> Self {
        Self { pool, redis }
    }

    pub fn redis_client(&self) -> &RedisClient {
        &self.redis
    }

    pub async fn redis_conn(&self) -> crate::error::Result<redis::aio::MultiplexedConnection> {
        Ok(self.redis.get_multiplexed_async_connection().await?)
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
