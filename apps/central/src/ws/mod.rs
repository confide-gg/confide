pub mod call_recovery;
pub mod handler;
mod pubsub;

pub use handler::{
    broadcast_activity_update, broadcast_key_update, send_call_answer, send_call_cancel,
    send_call_end, send_call_key_complete, send_call_leave, send_call_media_ready, send_call_offer,
    send_call_reject, send_call_rejoin, send_group_call_ended, send_group_call_mute_update,
    send_group_call_participant_joined, send_group_call_participant_left, send_group_call_ring,
    send_group_call_sender_key, send_new_message, CallAnswerData, CallCancelData, CallEndData,
    CallKeyCompleteData, CallLeaveData, CallMediaReadyData, CallOfferData, CallRejectData,
    CallRejoinData, FriendAcceptedData, FriendRemovedData, FriendRequestData, GroupCallEndedData,
    GroupCallMuteUpdateData, GroupCallParticipantJoinedData, GroupCallParticipantLeftData,
    GroupCallRingData, GroupCallSenderKeyData, GroupCreatedData, GroupDeletedData,
    GroupMemberAddedData, GroupMemberLeftData, GroupMemberRemovedData, GroupMetadataUpdatedData,
    GroupOwnerChangedData, KeyExchangeData, MessageDeletedData, MessageEditedData,
    MessagePinnedData, MessageUnpinnedData, NewMessageData, PresenceData, ReactionAddedData,
    ReactionRemovedData, WsMessage,
};

use axum::{
    extract::{ws::Message, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::time::{timeout, Duration};

use crate::error::AppError;
use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new().route("/", get(ws_handler))
}

#[derive(Debug, Deserialize)]
struct AuthMessage {
    #[serde(rename = "type")]
    msg_type: String,
    data: AuthData,
}

#[derive(Debug, Deserialize)]
struct AuthData {
    token: String,
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Result<Response, AppError> {
    Ok(ws.on_upgrade(move |socket| async move {
        let (sender, mut receiver) = socket.split();

        let auth_result = timeout(Duration::from_secs(10), async {
            while let Some(Ok(msg)) = receiver.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(auth_msg) = serde_json::from_str::<AuthMessage>(&text) {
                        if auth_msg.msg_type == "auth" {
                            return Some(auth_msg.data.token);
                        }
                    }
                }
            }
            None
        })
        .await;

        let token = match auth_result {
            Ok(Some(t)) => t,
            _ => {
                tracing::warn!("WebSocket auth timeout or missing auth message");
                return;
            }
        };

        let token_bytes = match hex::decode(&token) {
            Ok(b) => b,
            Err(_) => {
                tracing::warn!("WebSocket invalid token format");
                return;
            }
        };

        let token_hash = Sha256::digest(&token_bytes).to_vec();
        let session = match state.db.get_session_by_token_hash(&token_hash).await {
            Ok(Some(s)) => s,
            _ => {
                tracing::warn!("WebSocket invalid session");
                return;
            }
        };

        let user_id = session.user_id;
        let socket = sender.reunite(receiver).expect("reunite failed");
        handler::handle_socket(socket, state, user_id).await;
    }))
}
