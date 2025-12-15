pub mod call_recovery;
pub mod handler;
mod pubsub;

pub use handler::{
    broadcast_key_update, send_call_answer, send_call_cancel, send_call_end,
    send_call_key_complete, send_call_leave, send_call_media_ready, send_call_offer,
    send_call_reject, send_call_rejoin, send_new_message, CallAnswerData, CallCancelData,
    CallEndData, CallKeyCompleteData, CallLeaveData, CallMediaReadyData, CallOfferData,
    CallRejectData, CallRejoinData, FriendAcceptedData, FriendRemovedData, FriendRequestData,
    KeyExchangeData, MessageDeletedData, MessageEditedData, MessagePinnedData, MessageUnpinnedData,
    NewMessageData, PresenceData, ReactionAddedData, ReactionRemovedData, WsMessage,
};

use axum::{
    extract::{Query, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::Arc;

use crate::error::AppError;
use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new().route("/", get(ws_handler))
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: String,
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<WsQuery>,
) -> Result<Response, AppError> {
    let token_bytes = hex::decode(&query.token).map_err(|_| AppError::Unauthorized)?;
    let token_hash = Sha256::digest(&token_bytes).to_vec();

    let session = state
        .db
        .get_session_by_token_hash(&token_hash)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let user_id = session.user_id;

    Ok(ws.on_upgrade(move |socket| handler::handle_socket(socket, state, user_id)))
}
