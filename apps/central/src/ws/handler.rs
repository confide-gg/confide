use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    #[serde(rename = "new_message")]
    NewMessage(NewMessageData),
    #[serde(rename = "message_deleted")]
    MessageDeleted(MessageDeletedData),
    #[serde(rename = "message_edited")]
    MessageEdited(MessageEditedData),
    #[serde(rename = "message_pinned")]
    MessagePinned(MessagePinnedData),
    #[serde(rename = "message_unpinned")]
    MessageUnpinned(MessageUnpinnedData),
    #[serde(rename = "reaction_added")]
    ReactionAdded(ReactionAddedData),
    #[serde(rename = "reaction_removed")]
    ReactionRemoved(ReactionRemovedData),
    #[serde(rename = "group_created")]
    GroupCreated(GroupCreatedData),
    #[serde(rename = "group_member_added")]
    GroupMemberAdded(GroupMemberAddedData),
    #[serde(rename = "group_member_removed")]
    GroupMemberRemoved(GroupMemberRemovedData),
    #[serde(rename = "group_member_left")]
    GroupMemberLeft(GroupMemberLeftData),
    #[serde(rename = "group_owner_changed")]
    GroupOwnerChanged(GroupOwnerChangedData),
    #[serde(rename = "group_deleted")]
    GroupDeleted(GroupDeletedData),
    #[serde(rename = "group_metadata_updated")]
    GroupMetadataUpdated(GroupMetadataUpdatedData),
    #[serde(rename = "friend_request")]
    FriendRequest(FriendRequestData),
    #[serde(rename = "friend_accepted")]
    FriendAccepted(FriendAcceptedData),
    #[serde(rename = "friend_removed")]
    FriendRemoved(FriendRemovedData),
    #[serde(rename = "key_update")]
    KeyUpdate(KeyUpdateData),
    #[serde(rename = "key_exchange")]
    KeyExchange(KeyExchangeData),
    #[serde(rename = "typing")]
    Typing(TypingData),
    #[serde(rename = "presence_update")]
    Presence(PresenceData),
    #[serde(rename = "presence_sync")]
    PresenceSync(PresenceSyncData),
    #[serde(rename = "update_presence")]
    UpdatePresence(UpdatePresenceData),
    #[serde(rename = "subscribe_conversation")]
    SubscribeConversation(SubscribeConversationData),
    #[serde(rename = "subscribe_user")]
    SubscribeUser(SubscribeUserData),
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,

    #[serde(rename = "call_offer")]
    CallOffer(CallOfferData),
    #[serde(rename = "call_answer")]
    CallAnswer(CallAnswerData),
    #[serde(rename = "call_key_complete")]
    CallKeyComplete(CallKeyCompleteData),
    #[serde(rename = "call_reject")]
    CallReject(CallRejectData),
    #[serde(rename = "call_cancel")]
    CallCancel(CallCancelData),
    #[serde(rename = "call_end")]
    CallEnd(CallEndData),
    #[serde(rename = "call_media_ready")]
    CallMediaReady(CallMediaReadyData),
    #[serde(rename = "call_missed")]
    CallMissed(CallMissedData),
    #[serde(rename = "call_leave")]
    CallLeave(CallLeaveData),
    #[serde(rename = "call_rejoin")]
    CallRejoin(CallRejoinData),
    #[serde(rename = "call_recovery")]
    CallRecovery(CallRecoveryData),
    #[serde(rename = "call_health_warning")]
    CallHealthWarning(CallHealthWarningData),

    #[serde(rename = "screen_share_start")]
    ScreenShareStart(ScreenShareStartData),
    #[serde(rename = "screen_share_stop")]
    ScreenShareStop(ScreenShareStopData),
    #[serde(rename = "call_mute_update")]
    CallMuteUpdate(CallMuteUpdateData),

    #[serde(rename = "activity_update")]
    ActivityUpdate(ActivityUpdateData),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscribeConversationData {
    pub conversation_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubscribeUserData {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePresenceData {
    pub status: String,
    pub custom_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewMessageData {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub sender_chain_id: Option<i32>,
    pub sender_chain_iteration: Option<i32>,
    pub message_type: String,
    pub call_id: Option<Uuid>,
    pub call_duration_seconds: Option<i32>,
    pub pinned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageDeletedData {
    pub message_id: Uuid,
    pub conversation_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageEditedData {
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub edited_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessagePinnedData {
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub pinner_id: Uuid,
    pub pinned_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageUnpinnedData {
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub unpinner_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReactionAddedData {
    pub id: Uuid,
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReactionRemovedData {
    pub message_id: Uuid,
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FriendRequestData {
    pub id: Uuid,
    pub from_user_id: Uuid,
    pub encrypted_message: Option<Vec<u8>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FriendAcceptedData {
    pub by_user_id: Uuid,
    pub by_username: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FriendRemovedData {
    pub by_user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyUpdateData {
    pub user_id: Uuid,
    pub kem_public_key: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyExchangeData {
    pub id: Uuid,
    pub from_user_id: Uuid,
    pub to_user_id: Uuid,
    pub conversation_id: Uuid,
    pub key_bundle: Vec<u8>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TypingData {
    pub conversation_id: Uuid,
    #[serde(default)]
    pub user_id: Option<Uuid>,
    pub is_typing: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupCreatedData {
    pub conversation_id: Uuid,
    pub owner_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMemberAddedData {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub added_by: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMemberRemovedData {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub removed_by: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMemberLeftData {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupOwnerChangedData {
    pub conversation_id: Uuid,
    pub old_owner_id: Uuid,
    pub new_owner_id: Uuid,
    pub changed_by: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupDeletedData {
    pub conversation_id: Uuid,
    pub deleted_by: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMetadataUpdatedData {
    pub conversation_id: Uuid,
    pub updated_by: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PresenceData {
    #[serde(rename = "member_id")]
    pub user_id: Uuid,
    pub online: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PresenceInfo {
    #[serde(rename = "member_id")]
    pub user_id: Uuid,
    pub status: String,
    pub custom_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PresenceSyncData {
    pub online_users: Vec<PresenceInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityUpdateData {
    pub user_id: Uuid,
    pub activity: Option<crate::models::PublicActivity>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallOfferData {
    pub call_id: Uuid,
    pub caller_id: Uuid,
    pub callee_id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub caller_username: String,
    pub caller_display_name: Option<String>,
    pub caller_avatar_url: Option<String>,
    pub caller_identity_key: Vec<u8>,
    pub ephemeral_kem_public: Vec<u8>,
    pub signature: Vec<u8>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallAnswerData {
    pub call_id: Uuid,
    pub callee_id: Uuid,
    pub ephemeral_kem_public: Vec<u8>,
    pub kem_ciphertext: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallKeyCompleteData {
    pub call_id: Uuid,
    pub kem_ciphertext: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallRejectData {
    pub call_id: Uuid,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallCancelData {
    pub call_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallEndData {
    pub call_id: Uuid,
    pub reason: String,
    pub duration_seconds: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallMediaReadyData {
    pub call_id: Uuid,
    pub relay_endpoint: String,
    pub relay_token: Vec<u8>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallMissedData {
    pub call_id: Uuid,
    pub caller_id: Uuid,
    pub caller_username: String,
    pub caller_display_name: Option<String>,
    pub conversation_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallLeaveData {
    pub call_id: Uuid,
    pub user_id: Uuid,
    pub left_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallRejoinData {
    pub call_id: Uuid,
    pub user_id: Uuid,
    pub relay_endpoint: String,
    pub relay_token: Vec<u8>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallRecoveryData {
    pub call_id: Uuid,
    pub status: String,
    pub is_caller: bool,
    pub peer_id: Uuid,
    pub relay_endpoint: Option<String>,
    pub relay_token: Option<Vec<u8>>,
    pub relay_token_expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallHealthWarningData {
    pub call_id: Uuid,
    pub issue: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenShareStartData {
    pub call_id: Uuid,
    pub user_id: Uuid,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenShareStopData {
    pub call_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallMuteUpdateData {
    pub call_id: Uuid,
    pub user_id: Uuid,
    pub is_muted: bool,
}

pub async fn handle_socket(socket: WebSocket, state: Arc<AppState>, user_id: Uuid) {
    tracing::info!("WebSocket connected for user {}", user_id);

    let (mut sender, mut receiver) = socket.split();
    let (send_tx, mut send_rx) = mpsc::channel::<String>(100);

    let (pubsub, pubsub_handle) = match super::pubsub::PubSub::new(&state.redis).await {
        Ok((ps, handle)) => (ps, handle),
        Err(e) => {
            tracing::error!(
                "Failed to create pubsub connection for user {}: {:?}",
                user_id,
                e
            );
            return;
        }
    };

    let conversations = match state.db.get_user_conversations(user_id).await {
        Ok(convs) => convs,
        Err(e) => {
            tracing::error!("Failed to get user conversations for {}: {:?}", user_id, e);
            return;
        }
    };

    let initial_channels = vec![format!("user:{}", user_id)];

    if let Ok(Some(recovered_state)) =
        crate::ws::call_recovery::handle_websocket_reconnection(&state, user_id).await
    {
        tracing::info!(
            "Call state recovered for user {}: call {} (status: {:?})",
            user_id,
            recovered_state.call_id,
            recovered_state.status
        );

        let recovery_msg = WsMessage::CallRecovery(CallRecoveryData {
            call_id: recovered_state.call_id,
            status: recovered_state.status.as_str().to_string(),
            is_caller: recovered_state.is_caller,
            peer_id: recovered_state.peer_id,
            relay_endpoint: recovered_state.relay_endpoint,
            relay_token: recovered_state.relay_token,
            relay_token_expires_at: recovered_state.relay_token_expires_at,
        });

        if let Ok(json) = serde_json::to_string(&recovery_msg) {
            let _ = send_tx.send(json).await;
        }
    }

    let send_handle = tokio::spawn(async move {
        while let Some(json) = send_rx.recv().await {
            if sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    let (pubsub_tx, mut pubsub_rx) = mpsc::channel::<String>(100);
    let pubsub_run_handle = tokio::spawn(async move {
        pubsub.run(pubsub_tx).await;
    });

    let pubsub_handle_clone = pubsub_handle.clone();
    let pubsub_handle_task = tokio::spawn(async move {
        for channel in initial_channels {
            if let Err(e) = pubsub_handle_clone.subscribe(&channel).await {
                tracing::error!("Failed to subscribe to {}: {:?}", channel, e);
            }
        }
    });

    let send_tx_clone = send_tx.clone();
    let health_monitor_handle = tokio::spawn(async move {
        while let Some(msg) = pubsub_rx.recv().await {
            if send_tx_clone.send(msg).await.is_err() {
                break;
            }
        }
    });

    let state_clone = state.clone();
    let recv_handle = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    const MAX_WS_MESSAGE_SIZE: usize = 64 * 1024;
                    if text.len() > MAX_WS_MESSAGE_SIZE {
                        tracing::warn!(
                            "WebSocket message too large: {} bytes from user {}",
                            text.len(),
                            user_id
                        );
                        break;
                    }
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        handle_client_message(&state_clone, user_id, ws_msg, &pubsub_handle).await;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = pubsub_run_handle => {}
        _ = pubsub_handle_task => {}
        _ = send_handle => {}
        _ = recv_handle => {}
        _ = health_monitor_handle => {}
    }

    broadcast_presence(&state, &conversations, user_id, false).await;
    tracing::debug!("websocket connection closed for user {}", user_id);
}

async fn handle_client_message(
    state: &AppState,
    user_id: Uuid,
    msg: WsMessage,
    pubsub_handle: &super::pubsub::PubSubHandle,
) {
    match msg {
        WsMessage::SubscribeConversation(data) => {
            if let Ok(routing) = state
                .db
                .get_conversation_routing(data.conversation_id, user_id)
                .await
            {
                if routing.is_some() {
                    let channel = format!("conversation:{}", data.conversation_id);
                    if let Err(e) = pubsub_handle.subscribe(&channel).await {
                        tracing::error!(
                            "Failed to subscribe to conversation {}: {:?}",
                            data.conversation_id,
                            e
                        );
                    } else {
                        tracing::debug!("User {} dynamically subscribed to {}", user_id, channel);
                    }
                } else {
                    tracing::warn!(
                        "User {} tried to subscribe to conversation {} but is not a member",
                        user_id,
                        data.conversation_id
                    );
                }
            }
        }
        WsMessage::SubscribeUser(data) => {
            let channel = format!("user:{}", data.user_id);
            if let Err(e) = pubsub_handle.subscribe(&channel).await {
                tracing::error!("Failed to subscribe to user {}: {:?}", data.user_id, e);
            } else {
                tracing::debug!("User {} subscribed to user channel {}", user_id, channel);
                if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
                    let is_online: Result<bool, _> = redis::cmd("SISMEMBER")
                        .arg("online_users")
                        .arg(data.user_id.to_string())
                        .query_async(&mut conn)
                        .await;
                    let online = is_online.unwrap_or(false);
                    let (status, custom_status) = if online {
                        state
                            .db
                            .get_user_presence_data(data.user_id)
                            .await
                            .map(|(s, c)| (Some(s), c))
                            .unwrap_or((Some("online".to_string()), None))
                    } else {
                        (None, None)
                    };
                    let presence_msg = WsMessage::Presence(PresenceData {
                        user_id: data.user_id,
                        online,
                        status,
                        custom_status,
                    });
                    if let Ok(json) = serde_json::to_string(&presence_msg) {
                        let _ = publish_message(&state.redis, &channel, &json).await;
                    }
                }
            }
        }
        WsMessage::Typing(data) => {
            if let Ok(routing) = state
                .db
                .get_conversation_routing(data.conversation_id, user_id)
                .await
            {
                if routing.is_some() {
                    let typing_msg = WsMessage::Typing(TypingData {
                        conversation_id: data.conversation_id,
                        user_id: Some(user_id),
                        is_typing: data.is_typing,
                    });
                    if let Ok(json) = serde_json::to_string(&typing_msg) {
                        if let Ok(members) = state
                            .db
                            .get_conversation_members(data.conversation_id)
                            .await
                        {
                            for member in members {
                                let user_channel = format!("user:{}", member.user_id);
                                let _ = publish_message(&state.redis, &user_channel, &json).await;
                            }
                        }
                    }
                }
            }
        }
        WsMessage::UpdatePresence(data) => {
            if let Err(e) = state
                .db
                .update_user_presence(user_id, &data.status, data.custom_status.as_deref())
                .await
            {
                tracing::error!("Failed to update presence for user {}: {:?}", user_id, e);
            } else if let Ok(conversations) = state.db.get_user_conversations(user_id).await {
                broadcast_presence(state, &conversations, user_id, true).await;
            }
        }
        WsMessage::Ping => {}
        WsMessage::ScreenShareStart(data) => {
            if let Ok(Some(call)) = state
                .db
                .get_call_for_participant(data.call_id, user_id)
                .await
            {
                let peer_id = if call.caller_id == user_id {
                    call.callee_id
                } else {
                    call.caller_id
                };
                let msg = WsMessage::ScreenShareStart(data);
                if let Ok(json) = serde_json::to_string(&msg) {
                    let channel = format!("user:{}", peer_id);
                    let _ = publish_message(&state.redis, &channel, &json).await;
                    tracing::debug!("Forwarded screen_share_start to user {}", peer_id);
                }
            }
        }
        WsMessage::ScreenShareStop(data) => {
            if let Ok(Some(call)) = state
                .db
                .get_call_for_participant(data.call_id, user_id)
                .await
            {
                let peer_id = if call.caller_id == user_id {
                    call.callee_id
                } else {
                    call.caller_id
                };
                let msg = WsMessage::ScreenShareStop(data);
                if let Ok(json) = serde_json::to_string(&msg) {
                    let channel = format!("user:{}", peer_id);
                    let _ = publish_message(&state.redis, &channel, &json).await;
                    tracing::debug!("Forwarded screen_share_stop to user {}", peer_id);
                }
            }
        }
        WsMessage::CallMuteUpdate(data) => {
            if let Ok(Some(call)) = state
                .db
                .get_call_for_participant(data.call_id, user_id)
                .await
            {
                let peer_id = if call.caller_id == user_id {
                    call.callee_id
                } else {
                    call.caller_id
                };
                let msg = WsMessage::CallMuteUpdate(data);
                if let Ok(json) = serde_json::to_string(&msg) {
                    let channel = format!("user:{}", peer_id);
                    let _ = publish_message(&state.redis, &channel, &json).await;
                    tracing::debug!("Forwarded call_mute_update to user {}", peer_id);
                }
            }
        }
        _ => {}
    }
}

async fn publish_message(
    redis: &redis::Client,
    channel: &str,
    message: &str,
) -> Result<(), redis::RedisError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    redis::cmd("PUBLISH")
        .arg(channel)
        .arg(message)
        .query_async(&mut conn)
        .await
}

async fn broadcast_presence(
    state: &AppState,
    conversations: &[crate::models::ConversationWithRouting],
    user_id: Uuid,
    online: bool,
) {
    let redis = &state.redis;

    if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
        if online {
            let _: Result<(), _> = redis::cmd("SADD")
                .arg("online_users")
                .arg(user_id.to_string())
                .query_async(&mut conn)
                .await;
        } else {
            let _: Result<(), _> = redis::cmd("SREM")
                .arg("online_users")
                .arg(user_id.to_string())
                .query_async(&mut conn)
                .await;
        }
    }

    let (status, custom_status) = if online {
        let (s, c) = state
            .db
            .get_user_presence_data(user_id)
            .await
            .unwrap_or(("online".to_string(), None));
        (Some(s), c)
    } else {
        (None, None)
    };

    let presence_msg = WsMessage::Presence(PresenceData {
        user_id,
        online,
        status,
        custom_status,
    });
    if let Ok(json) = serde_json::to_string(&presence_msg) {
        let user_channel = format!("user:{}", user_id);
        let _ = publish_message(redis, &user_channel, &json).await;

        let conversation_ids: Vec<Uuid> = conversations.iter().map(|c| c.id).collect();
        if let Ok(user_ids) = state
            .db
            .get_members_for_conversations(&conversation_ids, user_id)
            .await
        {
            for uid in user_ids {
                let channel = format!("user:{}", uid);
                let _ = publish_message(redis, &channel, &json).await;
            }
        }
    }
}

pub async fn broadcast_key_update(state: &AppState, user_id: Uuid, kem_public_key: Vec<u8>) {
    let conversations = match state.db.get_user_conversations(user_id).await {
        Ok(convs) => convs,
        Err(e) => {
            tracing::error!(
                "Failed to get conversations for key update broadcast: {}",
                e
            );
            return;
        }
    };

    let key_update_msg = WsMessage::KeyUpdate(KeyUpdateData {
        user_id,
        kem_public_key,
    });

    if let Ok(json) = serde_json::to_string(&key_update_msg) {
        let conversation_ids: Vec<Uuid> = conversations.iter().map(|c| c.id).collect();
        if let Ok(user_ids) = state
            .db
            .get_members_for_conversations(&conversation_ids, user_id)
            .await
        {
            for uid in user_ids {
                let channel = format!("user:{}", uid);
                let _ = publish_message(&state.redis, &channel, &json).await;
            }
        }
    }
}

pub async fn send_call_offer(state: &AppState, callee_id: Uuid, data: CallOfferData) {
    let msg = WsMessage::CallOffer(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", callee_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_answer(state: &AppState, caller_id: Uuid, data: CallAnswerData) {
    let msg = WsMessage::CallAnswer(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", caller_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_key_complete(state: &AppState, callee_id: Uuid, data: CallKeyCompleteData) {
    let msg = WsMessage::CallKeyComplete(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", callee_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_media_ready(state: &AppState, user_id: Uuid, data: CallMediaReadyData) {
    let msg = WsMessage::CallMediaReady(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", user_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_reject(state: &AppState, caller_id: Uuid, data: CallRejectData) {
    let msg = WsMessage::CallReject(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", caller_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_cancel(state: &AppState, callee_id: Uuid, data: CallCancelData) {
    let msg = WsMessage::CallCancel(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", callee_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_end(state: &AppState, user_id: Uuid, data: CallEndData) {
    let msg = WsMessage::CallEnd(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", user_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

#[allow(dead_code)]
pub async fn send_call_missed(state: &AppState, callee_id: Uuid, data: CallMissedData) {
    let msg = WsMessage::CallMissed(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", callee_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_leave(state: &AppState, peer_id: Uuid, data: CallLeaveData) {
    let msg = WsMessage::CallLeave(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", peer_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_call_rejoin(state: &AppState, peer_id: Uuid, data: CallRejoinData) {
    let msg = WsMessage::CallRejoin(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("user:{}", peer_id);
        let _ = publish_message(&state.redis, &channel, &json).await;
    }
}

pub async fn send_new_message(
    state: &AppState,
    conversation_id: Uuid,
    data: NewMessageData,
    exclude_user: Option<Uuid>,
) {
    let msg = WsMessage::NewMessage(data);
    if let Ok(json) = serde_json::to_string(&msg) {
        let channel = format!("conversation:{}", conversation_id);
        let _ = publish_message(&state.redis, &channel, &json).await;

        if let Ok(members) = state.db.get_conversation_members(conversation_id).await {
            for member in members {
                if exclude_user != Some(member.user_id) {
                    let user_channel = format!("user:{}", member.user_id);
                    let _ = publish_message(&state.redis, &user_channel, &json).await;
                }
            }
        }
    }
}

pub async fn broadcast_activity_update(
    state: &AppState,
    user_id: Uuid,
    activity: Option<crate::models::PublicActivity>,
) {
    let conversations = match state.db.get_user_conversations(user_id).await {
        Ok(convs) => convs,
        Err(e) => {
            tracing::error!(
                "Failed to get conversations for activity update broadcast: {}",
                e
            );
            return;
        }
    };

    let activity_msg = WsMessage::ActivityUpdate(ActivityUpdateData { user_id, activity });

    if let Ok(json) = serde_json::to_string(&activity_msg) {
        let conversation_ids: Vec<Uuid> = conversations.iter().map(|c| c.id).collect();
        if let Ok(user_ids) = state
            .db
            .get_members_for_conversations(&conversation_ids, user_id)
            .await
        {
            for uid in user_ids {
                let channel = format!("user:{}", uid);
                let _ = publish_message(&state.redis, &channel, &json).await;
            }
        }
    }
}

#[allow(dead_code)]
async fn send_presence_sync(state: &AppState, tx: &mpsc::Sender<WsMessage>) {
    if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
        let online_user_ids: Result<Vec<String>, _> = redis::cmd("SMEMBERS")
            .arg("online_users")
            .query_async(&mut conn)
            .await;

        if let Ok(user_id_strings) = online_user_ids {
            let mut presence_infos = Vec::new();

            for uid_str in user_id_strings {
                if let Ok(uid) = Uuid::parse_str(&uid_str) {
                    let (status, custom_status) = state
                        .db
                        .get_user_presence_data(uid)
                        .await
                        .unwrap_or(("online".to_string(), None));

                    presence_infos.push(PresenceInfo {
                        user_id: uid,
                        status,
                        custom_status,
                    });
                }
            }

            let sync_msg = WsMessage::PresenceSync(PresenceSyncData {
                online_users: presence_infos,
            });

            let _ = tx.send(sync_msg).await;
        }
    }
}

#[allow(dead_code)]
async fn get_online_users(redis: &redis::Client, user_ids: &[Uuid]) -> Vec<Uuid> {
    if user_ids.is_empty() {
        return Vec::new();
    }

    if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
        let user_id_strings: Vec<String> = user_ids.iter().map(|id| id.to_string()).collect();

        let results: Result<Vec<bool>, _> = redis::cmd("SMISMEMBER")
            .arg("online_users")
            .arg(&user_id_strings)
            .query_async(&mut conn)
            .await;

        if let Ok(online_statuses) = results {
            user_ids
                .iter()
                .zip(online_statuses.iter())
                .filter_map(|(uid, is_online)| if *is_online { Some(*uid) } else { None })
                .collect()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    }
}
