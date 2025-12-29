mod activities;
mod attachments;
pub mod audio_settings;
pub mod cache;
mod calls;
pub mod cleanup;
mod conversations;
mod discovery;
mod federation;
mod friends;
mod gifs;
mod group_calls;
mod messages;
mod preferences;
mod profiles;
mod servers;
mod sessions;
mod spotify;
mod uploads;
mod users;

use redis::Client as RedisClient;
use sqlx::PgPool;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
    ws_pool: PgPool,
    redis: RedisClient,
}

impl Database {
    pub fn new(pool: PgPool, ws_pool: PgPool, redis: RedisClient) -> Self {
        Self {
            pool,
            ws_pool,
            redis,
        }
    }

    /// Begin a database transaction
    pub async fn begin_transaction(
        &self,
    ) -> crate::error::Result<sqlx::Transaction<'static, sqlx::Postgres>> {
        let tx = self.pool.begin().await?;
        Ok(tx)
    }

    /// Commit a transaction
    pub async fn commit_transaction(
        &self,
        tx: sqlx::Transaction<'static, sqlx::Postgres>,
    ) -> crate::error::Result<()> {
        tx.commit().await?;
        Ok(())
    }

    /// Rollback a transaction
    pub async fn rollback_transaction(
        &self,
        tx: sqlx::Transaction<'static, sqlx::Postgres>,
    ) -> crate::error::Result<()> {
        tx.rollback().await?;
        Ok(())
    }

    /// Execute within a transaction with automatic commit on success, rollback on error
    pub async fn with_transaction<F, T, Fut>(&self, func: F) -> crate::error::Result<T>
    where
        F: FnOnce(sqlx::Transaction<'static, sqlx::Postgres>) -> Fut,
        Fut: std::future::Future<
            Output = crate::error::Result<(T, sqlx::Transaction<'static, sqlx::Postgres>)>,
        >,
    {
        let tx = self.begin_transaction().await?;
        match func(tx).await {
            Ok((result, tx)) => {
                tx.commit().await?;
                Ok(result)
            }
            Err(e) => Err(e),
        }
    }
}
