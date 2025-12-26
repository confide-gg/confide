use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, Method},
    middleware::Next,
    response::Response,
};
use redis::Script;
use sha2::{Digest, Sha256};
use std::sync::Arc;

use crate::{error::AppError, AppState};

pub enum RateLimitTier {
    Auth,
    WebSocketConnect,
    Read,
    Write,
}

impl RateLimitTier {
    pub fn limits(&self) -> (u32, u64, &'static str) {
        match self {
            RateLimitTier::Auth => (5, 60, "auth"),
            RateLimitTier::WebSocketConnect => (30, 60, "ws"),
            RateLimitTier::Read => (300, 60, "read"),
            RateLimitTier::Write => (60, 60, "write"),
        }
    }

    pub fn from_request(path: &str, method: &Method) -> Self {
        if path.starts_with("/api/auth") || path.starts_with("/api/setup") {
            RateLimitTier::Auth
        } else if path.starts_with("/ws") {
            RateLimitTier::WebSocketConnect
        } else if *method == Method::GET || *method == Method::HEAD {
            RateLimitTier::Read
        } else {
            RateLimitTier::Write
        }
    }
}

fn extract_ws_token_from_query(query: Option<&str>) -> Option<String> {
    let q = query?;
    for part in q.split('&') {
        let (k, v) = part.split_once('=')?;
        if k == "token" && !v.is_empty() {
            return Some(v.to_string());
        }
    }
    None
}

pub async fn rate_limit_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let path = request.uri().path();
    let method = request.method().clone();

    let tier = RateLimitTier::from_request(path, &method);
    let (max_requests, window_seconds, tier_name) = tier.limits();

    let bearer = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .map(|t| t.to_string());

    let ws_token = if bearer.is_none() && path.starts_with("/ws") {
        extract_ws_token_from_query(request.uri().query())
    } else {
        None
    };

    let token = bearer.or(ws_token);

    let user_identifier = if let Some(token) = token {
        if let Ok(token_bytes) = hex::decode(&token) {
            let token_hash = Sha256::digest(&token_bytes);
            format!("user:{}", hex::encode(&token_hash[..8]))
        } else {
            "anon".to_string()
        }
    } else {
        "anon".to_string()
    };

    let rate_key = format!(
        "ratelimit:{}:{}:{}",
        tier_name,
        user_identifier,
        chrono::Utc::now().timestamp() / window_seconds as i64
    );

    let mut conn = state.db.redis_conn().await?;

    let script = Script::new(
        r#"
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return count
        "#,
    );

    let count: u32 = script
        .key(&rate_key)
        .arg(window_seconds as i64)
        .invoke_async(&mut conn)
        .await?;

    if count > max_requests {
        tracing::warn!(
            "Rate limit exceeded: tier={} user={} path={} count={}/{}",
            tier_name,
            user_identifier,
            path,
            count,
            max_requests
        );
        return Err(AppError::TooManyRequests);
    }

    Ok(next.run(request).await)
}
