use anyhow::Result;
use redis::{Client, Script};
use std::time::Duration;

const LOCK_TTL_MS: u64 = 5000;
const LOCK_ACQUISITION_TIMEOUT_MS: u64 = 500;
const LOCK_RETRY_DELAY_MS: u64 = 10;

pub struct CacheLock {
    redis: Client,
}

impl CacheLock {
    pub fn new(redis: Client) -> Self {
        Self { redis }
    }

    pub async fn with_lock<T, F, Fut>(&self, key: &str, fallback: F) -> Result<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let lock_acquired = self.try_acquire_lock(key).await?;

        if lock_acquired {
            let _guard = LockGuard {
                redis: self.redis.clone(),
                key: key.to_string(),
            };

            let result = fallback().await?;
            Ok(result)
        } else {
            self.wait_for_lock(key).await?;
            let result = fallback().await?;
            Ok(result)
        }
    }

    async fn try_acquire_lock(&self, key: &str) -> Result<bool> {
        let lock_key = format!("lock:{}", key);
        let lock_value = uuid::Uuid::new_v4().to_string();

        let script = Script::new(
            r#"
            if redis.call("exists", KEYS[1]) == 0 then
                redis.call("set", KEYS[1], ARGV[1], "PX", ARGV[2])
                return 1
            else
                return 0
            end
            "#,
        );

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let acquired: i32 = script
            .key(&lock_key)
            .arg(&lock_value)
            .arg(LOCK_TTL_MS)
            .invoke_async(&mut conn)
            .await?;

        Ok(acquired == 1)
    }

    async fn wait_for_lock(&self, key: &str) -> Result<()> {
        let lock_key = format!("lock:{}", key);
        let start = std::time::Instant::now();

        while start.elapsed() < Duration::from_millis(LOCK_ACQUISITION_TIMEOUT_MS) {
            let mut conn = self.redis.get_multiplexed_async_connection().await?;
            let exists: bool = redis::cmd("EXISTS")
                .arg(&lock_key)
                .query_async(&mut conn)
                .await?;

            if !exists {
                return Ok(());
            }

            tokio::time::sleep(Duration::from_millis(LOCK_RETRY_DELAY_MS)).await;
        }

        tracing::warn!(
            "Lock acquisition timeout for key: {}, proceeding anyway",
            key
        );
        Ok(())
    }
}

struct LockGuard {
    redis: Client,
    key: String,
}

impl Drop for LockGuard {
    fn drop(&mut self) {
        let redis = self.redis.clone();
        let lock_key = format!("lock:{}", self.key);

        tokio::spawn(async move {
            match redis.get_multiplexed_async_connection().await {
                Ok(mut conn) => {
                    let _: Result<(), redis::RedisError> = redis::cmd("DEL")
                        .arg(&lock_key)
                        .query_async(&mut conn)
                        .await;
                }
                Err(e) => {
                    tracing::error!("Failed to release lock for {}: {}", lock_key, e);
                }
            }
        });
    }
}
