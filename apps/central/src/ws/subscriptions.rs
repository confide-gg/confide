use dashmap::DashMap;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use tokio::sync::mpsc;
use uuid::Uuid;

pub type MessageSender = mpsc::Sender<String>;

#[derive(Clone, Debug)]
pub struct PresenceInfo {
    pub status: String,
    pub custom_status: Option<String>,
}

#[derive(Default)]
pub struct SubscriptionMetrics {
    pub active_connections: AtomicUsize,
    pub active_users: AtomicUsize,
    pub messages_delivered: AtomicU64,
}

pub struct SubscriptionManager {
    user_senders: DashMap<Uuid, Vec<MessageSender>>,
    conversation_subs: DashMap<Uuid, HashSet<Uuid>>,
    user_conversations: DashMap<Uuid, HashSet<Uuid>>,
    presence_subs: DashMap<Uuid, HashSet<Uuid>>,
    online_users: DashMap<Uuid, PresenceInfo>,
    pub metrics: SubscriptionMetrics,
}

impl SubscriptionManager {
    pub fn new() -> Self {
        Self {
            user_senders: DashMap::new(),
            conversation_subs: DashMap::new(),
            user_conversations: DashMap::new(),
            presence_subs: DashMap::new(),
            online_users: DashMap::new(),
            metrics: SubscriptionMetrics::default(),
        }
    }

    pub fn add_connection(&self, user_id: Uuid, sender: MessageSender) {
        self.user_senders.entry(user_id).or_default().push(sender);
        self.metrics
            .active_connections
            .fetch_add(1, Ordering::Relaxed);

        if self.user_senders.get(&user_id).map(|s| s.len()) == Some(1) {
            self.metrics.active_users.fetch_add(1, Ordering::Relaxed);
        }

        tracing::debug!("Added connection for user {}", user_id);
    }

    pub fn remove_connection(&self, user_id: Uuid) {
        if let Some((_, senders)) = self.user_senders.remove(&user_id) {
            self.metrics
                .active_connections
                .fetch_sub(senders.len(), Ordering::Relaxed);
            self.metrics.active_users.fetch_sub(1, Ordering::Relaxed);
        }

        if let Some((_, conv_ids)) = self.user_conversations.remove(&user_id) {
            for conv_id in conv_ids {
                if let Some(mut subs) = self.conversation_subs.get_mut(&conv_id) {
                    subs.remove(&user_id);
                }
            }
        }

        tracing::debug!("Removed all connections for user {}", user_id);
    }

    pub fn subscribe_conversation(&self, user_id: Uuid, conv_id: Uuid) {
        self.conversation_subs
            .entry(conv_id)
            .or_default()
            .insert(user_id);
        self.user_conversations
            .entry(user_id)
            .or_default()
            .insert(conv_id);

        tracing::debug!("User {} subscribed to conversation {}", user_id, conv_id);
    }

    pub fn subscribe_presence(&self, watcher_id: Uuid, watched_id: Uuid) {
        self.presence_subs
            .entry(watched_id)
            .or_default()
            .insert(watcher_id);

        tracing::debug!(
            "User {} subscribed to presence of {}",
            watcher_id,
            watched_id
        );
    }

    pub fn set_online(&self, user_id: Uuid, status: &str, custom_status: Option<String>) {
        self.online_users.insert(
            user_id,
            PresenceInfo {
                status: status.to_string(),
                custom_status,
            },
        );
    }

    pub fn set_offline(&self, user_id: Uuid) {
        self.online_users.remove(&user_id);
    }

    pub fn is_online(&self, user_id: Uuid) -> bool {
        self.online_users.contains_key(&user_id)
    }

    pub fn get_presence(&self, user_id: Uuid) -> Option<PresenceInfo> {
        self.online_users.get(&user_id).map(|p| p.clone())
    }

    pub fn get_online_user_ids(&self) -> Vec<Uuid> {
        self.online_users.iter().map(|r| *r.key()).collect()
    }

    pub async fn send_to_user(&self, user_id: Uuid, msg: &str) {
        if let Some(senders) = self.user_senders.get(&user_id) {
            for sender in senders.iter() {
                if sender.try_send(msg.to_string()).is_ok() {
                    self.metrics
                        .messages_delivered
                        .fetch_add(1, Ordering::Relaxed);
                }
            }
        }
    }

    pub async fn send_to_users(&self, user_ids: &[Uuid], msg: &str) {
        for user_id in user_ids {
            self.send_to_user(*user_id, msg).await;
        }
    }

    pub async fn broadcast_to_conversation(&self, conv_id: Uuid, msg: &str, exclude: Option<Uuid>) {
        if let Some(subscribers) = self.conversation_subs.get(&conv_id) {
            for user_id in subscribers.iter() {
                if exclude != Some(*user_id) {
                    self.send_to_user(*user_id, msg).await;
                }
            }
        }
    }

    pub async fn broadcast_to_conversation_members(
        &self,
        member_ids: &[Uuid],
        msg: &str,
        exclude: Option<Uuid>,
    ) {
        for user_id in member_ids {
            if exclude != Some(*user_id) {
                self.send_to_user(*user_id, msg).await;
            }
        }
    }

    pub async fn broadcast_presence_update(&self, user_id: Uuid, msg: &str) {
        if let Some(watchers) = self.presence_subs.get(&user_id) {
            for watcher_id in watchers.iter() {
                self.send_to_user(*watcher_id, msg).await;
            }
        }
    }

    pub fn log_metrics(&self) {
        tracing::info!(
            "SubscriptionManager: connections={}, users={}, messages_delivered={}",
            self.metrics.active_connections.load(Ordering::Relaxed),
            self.metrics.active_users.load(Ordering::Relaxed),
            self.metrics.messages_delivered.load(Ordering::Relaxed),
        );
    }
}

impl Default for SubscriptionManager {
    fn default() -> Self {
        Self::new()
    }
}
