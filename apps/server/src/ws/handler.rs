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

use crate::AppState;

use super::types::{ClientMessage, MemberPresence, ServerMessage};

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: String,
}

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<WsQuery>,
) -> Response {
    // Authenticate using session token
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

/// Authenticate a session token and return the member_id
async fn authenticate_token(state: &AppState, token: &str) -> Result<Uuid, String> {
    let token_bytes = hex::decode(token).map_err(|_| "Invalid token format")?;
    let token_hash = Sha256::digest(&token_bytes).to_vec();

    let session = state
        .db
        .get_session_by_token(&token_hash)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or("Session not found")?;

    if session.expires_at < chrono::Utc::now() {
        return Err("Session expired".into());
    }

    Ok(session.member_id)
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, member_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

    state.ws.add_connection(member_id, tx).await;

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

    let join_msg = ServerMessage::PresenceUpdate {
        member_id,
        status: "online".to_string(),
        online: true,
    };
    state.ws.broadcast_all_except(join_msg, member_id).await;

    // Task to forward messages from the channel to the WebSocket
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

    // Task to receive messages from the WebSocket
    let recv_task = {
        let state = state.clone();
        async move {
            while let Some(Ok(msg)) = receiver.next().await {
                match msg {
                    Message::Text(text) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            handle_client_message(&state, member_id, client_msg).await;
                        }
                    }
                    Message::Close(_) => break,
                    Message::Ping(_data) => {
                        // Pong is handled automatically by axum
                    }
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
    tracing::debug!("WebSocket connection closed for member {}", member_id);
}

/// Handle a message from the client
async fn handle_client_message(state: &AppState, member_id: Uuid, msg: ClientMessage) {
    match msg {
        ClientMessage::SubscribeChannel { channel_id } => {
            // Verify member has access to this channel
            let perms = state
                .db
                .get_member_permissions(member_id)
                .await
                .unwrap_or(0);
            if perms > 0 || state.db.get_channel(channel_id).await.is_ok() {
                state.ws.subscribe_channel(member_id, channel_id).await;
            }
        }
        ClientMessage::UnsubscribeChannel { channel_id } => {
            state.ws.unsubscribe_channel(member_id, channel_id).await;
        }
        ClientMessage::Typing { channel_id } => {
            // Get member info for the typing indicator
            if let Ok(Some(member)) = state.db.get_member(member_id).await {
                let msg = ServerMessage::TypingStart {
                    channel_id,
                    member_id,
                    username: member.username,
                };
                state
                    .ws
                    .broadcast_to_channel_except(channel_id, msg, member_id)
                    .await;
            }
        }
        ClientMessage::StopTyping { channel_id } => {
            let msg = ServerMessage::TypingStop {
                channel_id,
                member_id,
            };
            state
                .ws
                .broadcast_to_channel_except(channel_id, msg, member_id)
                .await;
        }
        ClientMessage::UpdatePresence { status } => {
            state.ws.update_presence(member_id, status.clone()).await;
            let msg = ServerMessage::PresenceUpdate {
                member_id,
                status,
                online: true,
            };
            state.ws.broadcast_all_except(msg, member_id).await;
        }
        ClientMessage::Ping => {
            state
                .ws
                .send_to_member(member_id, ServerMessage::Pong)
                .await;
        }
    }
}
