use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::models::permissions;
use crate::AppState;

use super::types::{ClientMessage, MemberPresence, ServerMessage};

struct ConnectionGuard {
    state: Arc<AppState>,
    member_id: Uuid,
    cleaned_up: bool,
}

impl ConnectionGuard {
    fn new(state: Arc<AppState>, member_id: Uuid) -> Self {
        Self {
            state,
            member_id,
            cleaned_up: false,
        }
    }

    fn mark_cleaned(&mut self) {
        self.cleaned_up = true;
    }
}

impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        if !self.cleaned_up {
            let state = self.state.clone();
            let member_id = self.member_id;
            tokio::spawn(async move {
                let leave_msg = ServerMessage::PresenceUpdate {
                    member_id,
                    status: "offline".to_string(),
                    online: false,
                };
                state.ws.broadcast_all_except(leave_msg, member_id).await;
                state.ws.remove_connection(member_id).await;
                tracing::debug!("WebSocket cleanup via guard for member {}", member_id);
            });
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<WsQuery>,
) -> Response {
    let member_id = match authenticate_token(&state, &query.token).await {
        Ok(id) => id,
        Err(e) => {
            tracing::warn!("WebSocket auth failed: {}", e);
            return Response::builder()
                .status(401)
                .body("Unauthorized".into())
                .unwrap();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, member_id))
}

async fn authenticate_token(state: &AppState, token: &str) -> Result<Uuid, String> {
    let token_bytes = hex::decode(token).map_err(|_| "Authentication failed")?;
    let token_hash = Sha256::digest(&token_bytes).to_vec();

    let session = state
        .db
        .get_session_by_token(&token_hash)
        .await
        .map_err(|_| "Authentication failed")?
        .ok_or("Authentication failed")?;

    if session.expires_at < chrono::Utc::now() {
        return Err("Authentication failed".into());
    }

    Ok(session.member_id)
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, member_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

    state.ws.add_connection(member_id, tx).await;
    let mut guard = ConnectionGuard::new(state.clone(), member_id);

    let connected_msg = ServerMessage::Connected { member_id };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        let _ = sender.send(Message::Text(json.into())).await;
    }

    let presences = state.ws.get_all_presences().await;
    let presence_sync = ServerMessage::PresenceSync {
        presences: presences
            .into_iter()
            .map(|(mid, status)| MemberPresence {
                member_id: mid,
                status,
            })
            .collect(),
    };
    if let Ok(json) = serde_json::to_string(&presence_sync) {
        let _ = sender.send(Message::Text(json.into())).await;
    }

    if let Ok(all_member_roles) = state.db.get_all_member_roles().await {
        for (mid, role_ids) in all_member_roles {
            let role_sync = ServerMessage::MemberRolesUpdated {
                member_id: mid,
                role_ids,
            };
            if let Ok(json) = serde_json::to_string(&role_sync) {
                let _ = sender.send(Message::Text(json.into())).await;
            }
        }
    }

    let join_msg = ServerMessage::PresenceUpdate {
        member_id,
        status: "online".to_string(),
        online: true,
    };
    state.ws.broadcast_all_except(join_msg, member_id).await;

    let send_task = {
        let mut sender = sender;
        async move {
            while let Some(msg) = rx.recv().await {
                if let Ok(json) = serde_json::to_string(&msg) {
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    };

    let recv_task = {
        let state = state.clone();
        async move {
            while let Some(Ok(msg)) = receiver.next().await {
                match msg {
                    Message::Text(text) => {
                        if text.len() > 16 * 1024 {
                            tracing::warn!(
                                "Member {} sent oversized WS message ({} bytes), ignoring",
                                member_id,
                                text.len()
                            );
                            continue;
                        }
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            handle_client_message(&state, member_id, client_msg).await;
                        }
                    }
                    Message::Close(_) => break,
                    Message::Ping(_data) => {}
                    _ => {}
                }
            }
        }
    };

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    let leave_msg = ServerMessage::PresenceUpdate {
        member_id,
        status: "offline".to_string(),
        online: false,
    };
    state.ws.broadcast_all_except(leave_msg, member_id).await;

    state.ws.remove_connection(member_id).await;
    guard.mark_cleaned();
    tracing::debug!("WebSocket connection closed for member {}", member_id);
}

async fn handle_client_message(state: &AppState, member_id: Uuid, msg: ClientMessage) {
    match msg {
        ClientMessage::SubscribeChannel { channel_id } => {
            match state.db.get_channel(channel_id).await {
                Ok(Some(_)) => match state.db.get_member_permissions(member_id).await {
                    Ok(perms) if permissions::has_permission(perms, permissions::READ_MESSAGES) => {
                        state.ws.subscribe_channel(member_id, channel_id).await;
                    }
                    Ok(perms) => {
                        tracing::warn!(
                            "Member {} attempted to subscribe to channel {} without READ_MESSAGES (perms={})",
                            member_id,
                            channel_id,
                            perms
                        );
                    }
                    Err(e) => tracing::error!("Error checking member permissions: {:?}", e),
                },
                Ok(None) => {
                    tracing::warn!(
                        "Member {} attempted to subscribe to non-existent channel {}",
                        member_id,
                        channel_id
                    );
                }
                Err(e) => {
                    tracing::error!("Error checking channel existence: {:?}", e);
                }
            }
        }
        ClientMessage::UnsubscribeChannel { channel_id } => {
            state.ws.unsubscribe_channel(member_id, channel_id).await;
        }
        ClientMessage::Typing { channel_id } => {
            if !state.ws.is_subscribed(member_id, channel_id).await {
                return;
            }
            match state.db.get_member_permissions(member_id).await {
                Ok(perms) if permissions::has_permission(perms, permissions::SEND_MESSAGES) => {
                    if let Ok(Some(member)) = state.db.get_member(member_id).await {
                        let msg = ServerMessage::TypingStart {
                            data: crate::ws::types::TypingStartData {
                                channel_id,
                                member_id,
                                username: member.username,
                            },
                        };
                        state
                            .ws
                            .broadcast_to_channel_except(channel_id, msg, member_id)
                            .await;
                    }
                }
                Ok(_) => {}
                Err(e) => tracing::error!("Error checking member permissions: {:?}", e),
            }
        }
        ClientMessage::StopTyping { channel_id } => {
            if !state.ws.is_subscribed(member_id, channel_id).await {
                return;
            }
            let msg = ServerMessage::TypingStop {
                data: crate::ws::types::TypingStopData {
                    channel_id,
                    member_id,
                },
            };
            state
                .ws
                .broadcast_to_channel_except(channel_id, msg, member_id)
                .await;
        }
        ClientMessage::UpdatePresence { status } => {
            let status = if status.len() > 64 {
                status.chars().take(64).collect::<String>()
            } else {
                status
            };
            state.ws.update_presence(member_id, status.clone()).await;
            let msg = ServerMessage::PresenceUpdate {
                member_id,
                status,
                online: true,
            };
            state.ws.broadcast_all_except(msg, member_id).await;
        }
        ClientMessage::SubscribeUser { user_id } => {
            if state.db.get_member(user_id).await.ok().flatten().is_none() {
                return;
            }
            if let Some(status) = state.ws.get_presence(user_id).await {
                let msg = ServerMessage::PresenceUpdate {
                    member_id: user_id,
                    status,
                    online: true,
                };
                state.ws.send_to_member(member_id, msg).await;
            } else {
                let msg = ServerMessage::PresenceUpdate {
                    member_id: user_id,
                    status: "offline".to_string(),
                    online: false,
                };
                state.ws.send_to_member(member_id, msg).await;
            }
        }
        ClientMessage::Ping => {
            state
                .ws
                .send_to_member(member_id, ServerMessage::Pong)
                .await;
        }
    }
}
