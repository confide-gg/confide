use std::collections::{HashMap, HashSet};

use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use super::types::ServerMessage;

/// Sender type for sending messages to a WebSocket connection
pub type WsSender = mpsc::UnboundedSender<ServerMessage>;

/// Connection info for a connected member
#[derive(Debug)]
pub struct Connection {
    pub member_id: Uuid,
    pub sender: WsSender,
    pub subscribed_channels: HashSet<Uuid>,
}

/// Manages all WebSocket connections and channel subscriptions
#[derive(Debug, Default)]
pub struct ConnectionManager {
    connections: RwLock<HashMap<Uuid, Connection>>,
    channel_subscriptions: RwLock<HashMap<Uuid, HashSet<Uuid>>>,
    member_presence: RwLock<HashMap<Uuid, String>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
            channel_subscriptions: RwLock::new(HashMap::new()),
            member_presence: RwLock::new(HashMap::new()),
        }
    }

    pub async fn add_connection(&self, member_id: Uuid, sender: WsSender) {
        let mut connections = self.connections.write().await;

        if let Some(old_conn) = connections.remove(&member_id) {
            let mut subs = self.channel_subscriptions.write().await;
            for channel_id in old_conn.subscribed_channels {
                if let Some(members) = subs.get_mut(&channel_id) {
                    members.remove(&member_id);
                }
            }
        }

        connections.insert(
            member_id,
            Connection {
                member_id,
                sender,
                subscribed_channels: HashSet::new(),
            },
        );

        let mut presence = self.member_presence.write().await;
        presence.insert(member_id, "online".to_string());

        tracing::debug!("Member {} connected via WebSocket", member_id);
    }

    pub async fn remove_connection(&self, member_id: Uuid) {
        let mut connections = self.connections.write().await;

        if let Some(conn) = connections.remove(&member_id) {
            let mut subs = self.channel_subscriptions.write().await;
            for channel_id in conn.subscribed_channels {
                if let Some(members) = subs.get_mut(&channel_id) {
                    members.remove(&member_id);
                }
            }
        }

        let mut presence = self.member_presence.write().await;
        presence.remove(&member_id);

        tracing::debug!("Member {} disconnected from WebSocket", member_id);
    }

    /// Subscribe a member to a channel
    pub async fn subscribe_channel(&self, member_id: Uuid, channel_id: Uuid) {
        let mut connections = self.connections.write().await;
        let mut subs = self.channel_subscriptions.write().await;

        if let Some(conn) = connections.get_mut(&member_id) {
            conn.subscribed_channels.insert(channel_id);
            subs.entry(channel_id).or_default().insert(member_id);
            tracing::debug!("Member {} subscribed to channel {}", member_id, channel_id);
        }
    }

    /// Unsubscribe a member from a channel
    pub async fn unsubscribe_channel(&self, member_id: Uuid, channel_id: Uuid) {
        let mut connections = self.connections.write().await;
        let mut subs = self.channel_subscriptions.write().await;

        if let Some(conn) = connections.get_mut(&member_id) {
            conn.subscribed_channels.remove(&channel_id);
        }

        if let Some(members) = subs.get_mut(&channel_id) {
            members.remove(&member_id);
        }

        tracing::debug!(
            "Member {} unsubscribed from channel {}",
            member_id,
            channel_id
        );
    }

    /// Broadcast a message to all members subscribed to a channel
    pub async fn broadcast_to_channel(&self, channel_id: Uuid, message: ServerMessage) {
        let connections = self.connections.read().await;
        let subs = self.channel_subscriptions.read().await;

        if let Some(member_ids) = subs.get(&channel_id) {
            for member_id in member_ids {
                if let Some(conn) = connections.get(member_id) {
                    if conn.sender.send(message.clone()).is_err() {
                        tracing::warn!(
                            "Failed to send message to member {}, connection may be dead",
                            member_id
                        );
                    }
                }
            }
        }
    }

    /// Broadcast a message to all members subscribed to a channel, except one
    pub async fn broadcast_to_channel_except(
        &self,
        channel_id: Uuid,
        message: ServerMessage,
        except_member_id: Uuid,
    ) {
        let connections = self.connections.read().await;
        let subs = self.channel_subscriptions.read().await;

        if let Some(member_ids) = subs.get(&channel_id) {
            for member_id in member_ids {
                if *member_id != except_member_id {
                    if let Some(conn) = connections.get(member_id) {
                        if conn.sender.send(message.clone()).is_err() {
                            tracing::warn!(
                                "Failed to send message to member {}, connection may be dead",
                                member_id
                            );
                        }
                    }
                }
            }
        }
    }

    /// Broadcast a message to all connected members
    pub async fn broadcast_all(&self, message: ServerMessage) {
        let connections = self.connections.read().await;

        for conn in connections.values() {
            if conn.sender.send(message.clone()).is_err() {
                tracing::warn!(
                    "Failed to send message to member {}, connection may be dead",
                    conn.member_id
                );
            }
        }
    }

    /// Broadcast a message to all connected members except one
    pub async fn broadcast_all_except(&self, message: ServerMessage, except_member_id: Uuid) {
        let connections = self.connections.read().await;

        for conn in connections.values() {
            if conn.member_id != except_member_id && conn.sender.send(message.clone()).is_err() {
                tracing::warn!(
                    "Failed to send message to member {}, connection may be dead",
                    conn.member_id
                );
            }
        }
    }

    /// Send a message to a specific member
    pub async fn send_to_member(&self, member_id: Uuid, message: ServerMessage) {
        let connections = self.connections.read().await;

        if let Some(conn) = connections.get(&member_id) {
            if conn.sender.send(message).is_err() {
                tracing::warn!(
                    "Failed to send message to member {}, connection may be dead",
                    member_id
                );
            }
        }
    }

    /// Get the number of connected members
    pub async fn connection_count(&self) -> usize {
        self.connections.read().await.len()
    }

    /// Check if a member is connected
    pub async fn is_connected(&self, member_id: Uuid) -> bool {
        self.connections.read().await.contains_key(&member_id)
    }

    pub async fn get_subscribed_members(&self, channel_id: Uuid) -> Vec<Uuid> {
        let subs = self.channel_subscriptions.read().await;
        subs.get(&channel_id)
            .map(|members| members.iter().copied().collect())
            .unwrap_or_default()
    }

    pub async fn update_presence(&self, member_id: Uuid, status: String) {
        let mut presence = self.member_presence.write().await;
        presence.insert(member_id, status);
    }

    pub async fn get_all_presences(&self) -> Vec<(Uuid, String)> {
        let presence = self.member_presence.read().await;
        presence
            .iter()
            .map(|(id, status)| (*id, status.clone()))
            .collect()
    }

    pub async fn get_connected_member_ids(&self) -> Vec<Uuid> {
        self.connections.read().await.keys().copied().collect()
    }

    pub async fn get_presence(&self, member_id: Uuid) -> Option<String> {
        self.member_presence.read().await.get(&member_id).cloned()
    }
}
