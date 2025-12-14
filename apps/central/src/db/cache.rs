use anyhow::Result;
use redis::{AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};

pub async fn cached_get<T, F, Fut>(
    redis: &Client,
    cache_key: &str,
    ttl: u64,
    fallback: F,
) -> Result<T>
where
    T: Serialize + DeserializeOwned,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut conn = redis.get_multiplexed_async_connection().await?;

    if let Ok(cached) = conn.get::<_, String>(cache_key).await {
        if let Ok(value) = serde_json::from_str::<T>(&cached) {
            tracing::debug!("cache hit: {}", cache_key);
            return Ok(value);
        }
    }

    tracing::debug!("cache miss: {}", cache_key);
    let value = fallback().await?;

    let serialized = serde_json::to_string(&value)?;

    if is_empty_collection(&serialized) {
        let _: () = conn.set_ex(cache_key, &serialized, 10).await?;
        tracing::debug!("cached empty result with short TTL: {}", cache_key);
    } else {
        let _: () = conn.set_ex(cache_key, serialized, ttl).await?;
    }

    Ok(value)
}

fn is_empty_collection(json: &str) -> bool {
    json == "[]" || json == "{}" || json == "null"
}

pub async fn cached_get_optional<T, F, Fut>(
    redis: &Client,
    cache_key: &str,
    ttl: u64,
    fallback: F,
) -> Result<Option<T>>
where
    T: Serialize + DeserializeOwned,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Option<T>>>,
{
    let mut conn = redis.get_multiplexed_async_connection().await?;

    if let Ok(cached) = conn.get::<_, String>(cache_key).await {
        if cached == "null" {
            tracing::debug!("cache hit (null): {}", cache_key);
            return Ok(None);
        }
        if let Ok(value) = serde_json::from_str::<T>(&cached) {
            tracing::debug!("cache hit: {}", cache_key);
            return Ok(Some(value));
        }
    }

    tracing::debug!("cache miss: {}", cache_key);
    let value = fallback().await?;

    let serialized = match &value {
        Some(v) => serde_json::to_string(v)?,
        None => "null".to_string(),
    };
    let _: () = conn.set_ex(cache_key, serialized, ttl).await?;

    Ok(value)
}

#[allow(dead_code)]
pub async fn invalidate_cache(redis: &Client, pattern: &str) -> Result<()> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let _: () = redis::cmd("DEL")
        .arg(pattern)
        .query_async(&mut conn)
        .await?;
    tracing::debug!("invalidated cache: {}", pattern);
    Ok(())
}

pub async fn invalidate_cache_pattern(redis: &Client, pattern: &str) -> Result<()> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(pattern)
        .query_async(&mut conn)
        .await?;

    if !keys.is_empty() {
        let _: () = redis::cmd("DEL").arg(&keys).query_async(&mut conn).await?;
        tracing::debug!(
            "invalidated {} keys matching pattern: {}",
            keys.len(),
            pattern
        );
    }

    Ok(())
}
