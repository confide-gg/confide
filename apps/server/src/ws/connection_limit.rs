use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub const MAX_CONNECTIONS_PER_USER: usize = 5;
pub const MAX_GLOBAL_CONNECTIONS: usize = 10000;

#[derive(Debug, Clone)]
pub struct ConnectionLimiter {
    user_connections: Arc<RwLock<HashMap<Uuid, usize>>>,
    global_count: Arc<AtomicUsize>,
}

impl ConnectionLimiter {
    pub fn new() -> Self {
        Self {
            user_connections: Arc::new(RwLock::new(HashMap::new())),
            global_count: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub async fn try_add_connection(&self, member_id: Uuid) -> Result<ConnectionGuard, String> {
        let current_global = self.global_count.load(Ordering::Relaxed);
        if current_global >= MAX_GLOBAL_CONNECTIONS {
            tracing::warn!(
                "Global connection limit reached: {} connections",
                current_global
            );
            return Err(format!(
                "Server connection limit reached ({} connections)",
                MAX_GLOBAL_CONNECTIONS
            ));
        }

        let mut user_conns = self.user_connections.write().await;
        let user_count = user_conns.get(&member_id).copied().unwrap_or(0);

        if user_count >= MAX_CONNECTIONS_PER_USER {
            tracing::warn!(
                "User {} exceeded connection limit: {} connections",
                member_id,
                user_count
            );
            return Err(format!(
                "User connection limit reached ({} connections per user)",
                MAX_CONNECTIONS_PER_USER
            ));
        }

        *user_conns.entry(member_id).or_insert(0) += 1;
        drop(user_conns);

        self.global_count.fetch_add(1, Ordering::Relaxed);

        tracing::debug!(
            "Connection added for member {}. User: {}/{}, Global: {}/{}",
            member_id,
            user_count + 1,
            MAX_CONNECTIONS_PER_USER,
            current_global + 1,
            MAX_GLOBAL_CONNECTIONS
        );

        Ok(ConnectionGuard {
            member_id,
            limiter: self.clone(),
        })
    }

    async fn remove_connection(&self, member_id: Uuid) {
        let mut user_conns = self.user_connections.write().await;

        if let Some(count) = user_conns.get_mut(&member_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                user_conns.remove(&member_id);
            }
        }
        drop(user_conns);

        let prev_global = self.global_count.fetch_sub(1, Ordering::Relaxed);

        tracing::debug!(
            "Connection removed for member {}. Global: {}/{}",
            member_id,
            prev_global.saturating_sub(1),
            MAX_GLOBAL_CONNECTIONS
        );
    }

    pub fn current_global_connections(&self) -> usize {
        self.global_count.load(Ordering::Relaxed)
    }

    pub async fn current_user_connections(&self, member_id: Uuid) -> usize {
        let user_conns = self.user_connections.read().await;
        user_conns.get(&member_id).copied().unwrap_or(0)
    }
}

impl Default for ConnectionLimiter {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ConnectionGuard {
    member_id: Uuid,
    limiter: ConnectionLimiter,
}

impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        let member_id = self.member_id;
        let limiter = self.limiter.clone();

        tokio::spawn(async move {
            limiter.remove_connection(member_id).await;
        });
    }
}
