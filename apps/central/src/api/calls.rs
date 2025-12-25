use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::middleware::AuthUser;
use crate::error::{AppError, Result};
use crate::models::{
    AnswerCallRequest, CallEndReason, CallResponse, CallStatus, CallWithPeerInfo,
    CreateCallRequest, EndCallRequest, KeyExchangeCompleteRequest, RelayCredentials,
};
use crate::ws::{
    send_call_answer, send_call_cancel, send_call_end, send_call_key_complete, send_call_leave,
    send_call_media_ready, send_call_offer, send_call_reject, send_call_rejoin, send_new_message,
    CallAnswerData, CallCancelData, CallEndData, CallKeyCompleteData, CallLeaveData,
    CallMediaReadyData, CallOfferData, CallRejectData, CallRejoinData, NewMessageData,
};
use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(initiate_call))
        .route("/{call_id}", get(get_call))
        .route("/{call_id}/answer", post(answer_call))
        .route("/{call_id}/reject", post(reject_call))
        .route("/{call_id}/cancel", post(cancel_call))
        .route("/{call_id}/key-complete", post(key_exchange_complete))
        .route("/{call_id}/end", post(end_call))
        .route("/{call_id}/leave", post(leave_call))
        .route("/{call_id}/rejoin", post(rejoin_call))
        .route("/history", get(get_call_history))
        .route("/active", get(get_active_call))
        .route("/rejoinable", get(get_rejoinable_call))
}

async fn initiate_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Json(req): Json<CreateCallRequest>,
) -> Result<Json<CallResponse>> {
    if !state.config.calls.enabled {
        return Err(AppError::BadRequest("Calls are not enabled".into()));
    }

    if req.callee_id == user_id {
        return Err(AppError::BadRequest("Cannot call yourself".into()));
    }

    let call = state
        .db
        .create_call(
            req.call_id,
            user_id,
            req.callee_id,
            req.conversation_id,
            &req.ephemeral_kem_public,
        )
        .await?;

    let caller_profile = state.db.get_profile(user_id).await?;
    let caller_user = state
        .db
        .get_user_by_id(user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;
    let (username, display_name, avatar_url, identity_key) = (
        caller_user.username,
        caller_profile.as_ref().and_then(|p| p.display_name.clone()),
        caller_profile.as_ref().and_then(|p| p.avatar_url.clone()),
        caller_user.dsa_public_key,
    );

    send_call_offer(
        &state,
        req.callee_id,
        CallOfferData {
            call_id: call.id,
            caller_id: user_id,
            callee_id: req.callee_id,
            conversation_id: req.conversation_id,
            caller_username: username,
            caller_display_name: display_name,
            caller_avatar_url: avatar_url,
            caller_identity_key: identity_key,
            ephemeral_kem_public: req.ephemeral_kem_public,
            signature: req.signature,
            created_at: call.created_at,
        },
    )
    .await;

    Ok(Json(CallResponse::from(call)))
}

async fn get_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<CallWithPeerInfo>> {
    let result = state.db.get_call_with_peer_info(call_id, user_id).await?;

    match result {
        Some((call, username, display_name, avatar_url)) => Ok(Json(CallWithPeerInfo {
            call: CallResponse::from(call),
            peer_username: username,
            peer_display_name: display_name,
            peer_avatar_url: avatar_url,
        })),
        None => Err(AppError::NotFound("Call not found".into())),
    }
}

async fn answer_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
    Json(req): Json<AnswerCallRequest>,
) -> Result<Json<CallResponse>> {
    let call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    if call.callee_id != user_id {
        return Err(AppError::Forbidden);
    }

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;
    if status != CallStatus::Ringing {
        return Err(AppError::BadRequest("Call is not ringing".into()));
    }

    let call = state
        .db
        .update_call_status(call_id, CallStatus::Connecting)
        .await?;

    state
        .db
        .set_callee_ephemeral_public(call_id, &req.ephemeral_kem_public)
        .await?;

    send_call_answer(
        &state,
        call.caller_id,
        CallAnswerData {
            call_id,
            callee_id: user_id,
            ephemeral_kem_public: req.ephemeral_kem_public,
            kem_ciphertext: req.kem_ciphertext,
            signature: req.signature,
        },
    )
    .await;

    Ok(Json(CallResponse::from(call)))
}

async fn key_exchange_complete(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
    Json(req): Json<KeyExchangeCompleteRequest>,
) -> Result<Json<RelayCredentials>> {
    let call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    if call.caller_id != user_id {
        return Err(AppError::Forbidden);
    }

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;
    if status != CallStatus::Connecting {
        return Err(AppError::BadRequest(
            "Call is not in connecting state".into(),
        ));
    }

    send_call_key_complete(
        &state,
        call.callee_id,
        CallKeyCompleteData {
            call_id,
            kem_ciphertext: req.kem_ciphertext,
        },
    )
    .await;

    let call = state
        .db
        .update_call_status(call_id, CallStatus::Active)
        .await?;

    let relay_config = &state.config.calls.relay;
    let expires_at = Utc::now() + Duration::hours(3);

    let caller_token = generate_relay_token(
        &relay_config.token_secret,
        call_id,
        user_id,
        true,
        expires_at,
    )?;
    let callee_token = generate_relay_token(
        &relay_config.token_secret,
        call_id,
        call.callee_id,
        false,
        expires_at,
    )?;

    let token_hash = Sha256::digest(&caller_token).to_vec();
    state
        .db
        .set_relay_token(call_id, &token_hash, expires_at)
        .await?;

    let relay_endpoint = format!("{}:{}", relay_config.public_host, relay_config.bind_port);

    send_call_media_ready(
        &state,
        call.callee_id,
        CallMediaReadyData {
            call_id,
            relay_endpoint: relay_endpoint.clone(),
            relay_token: callee_token,
            expires_at,
        },
    )
    .await;

    Ok(Json(RelayCredentials {
        call_id,
        relay_endpoint,
        relay_token: caller_token,
        expires_at,
    }))
}

async fn reject_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<StatusCode> {
    let call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    if call.callee_id != user_id {
        return Err(AppError::Forbidden);
    }

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;
    if !matches!(status, CallStatus::Ringing | CallStatus::Pending) {
        return Err(AppError::BadRequest("Call cannot be rejected".into()));
    }

    state
        .db
        .end_call(call_id, CallStatus::Rejected, CallEndReason::Declined)
        .await?;

    send_call_reject(
        &state,
        call.caller_id,
        CallRejectData {
            call_id,
            reason: "declined".to_string(),
        },
    )
    .await;

    if let Some(conv) = state
        .db
        .find_dm_conversation(call.caller_id, call.callee_id)
        .await?
    {
        if !state.db.has_call_message(call_id, "call_rejected").await? {
            let message = state
                .db
                .create_call_event_message(conv.id, user_id, "call_rejected", call_id, None)
                .await?;

            send_new_message(
                &state,
                conv.id,
                NewMessageData {
                    id: message.id,
                    conversation_id: conv.id,
                    sender_id: user_id,
                    encrypted_content: vec![],
                    signature: vec![],
                    reply_to_id: None,
                    expires_at: None,
                    sender_chain_id: None,
                    sender_chain_iteration: None,
                    message_type: "call_rejected".to_string(),
                    call_id: Some(call_id),
                    call_duration_seconds: None,
                    pinned_at: None,
                    created_at: message.created_at,
                },
                None,
            )
            .await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn cancel_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<StatusCode> {
    let call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    if call.caller_id != user_id {
        return Err(AppError::Forbidden);
    }

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;
    if !matches!(status, CallStatus::Ringing | CallStatus::Pending) {
        return Err(AppError::BadRequest("Call cannot be cancelled".into()));
    }

    state
        .db
        .end_call(call_id, CallStatus::Cancelled, CallEndReason::Cancelled)
        .await?;

    send_call_cancel(&state, call.callee_id, CallCancelData { call_id }).await;

    if let Some(conv) = state
        .db
        .find_dm_conversation(call.caller_id, call.callee_id)
        .await?
    {
        if !state.db.has_call_message(call_id, "call_missed").await? {
            let message = state
                .db
                .create_call_event_message(conv.id, call.caller_id, "call_missed", call_id, None)
                .await?;

            send_new_message(
                &state,
                conv.id,
                NewMessageData {
                    id: message.id,
                    conversation_id: conv.id,
                    sender_id: call.caller_id,
                    encrypted_content: vec![],
                    signature: vec![],
                    reply_to_id: None,
                    expires_at: None,
                    sender_chain_id: None,
                    sender_chain_iteration: None,
                    message_type: "call_missed".to_string(),
                    call_id: Some(call_id),
                    call_duration_seconds: None,
                    pinned_at: None,
                    created_at: message.created_at,
                },
                None,
            )
            .await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn end_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
    Json(req): Json<EndCallRequest>,
) -> Result<Json<CallResponse>> {
    let _call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let ended_call = state
        .db
        .try_end_call(call_id, CallStatus::Ended, req.reason)
        .await?;

    let call = match ended_call {
        Some(c) => c,
        None => {
            let current = state
                .db
                .get_call(call_id)
                .await?
                .ok_or_else(|| AppError::NotFound("Call not found".into()))?;
            return Ok(Json(CallResponse::from(current)));
        }
    };

    let peer_id = if call.caller_id == user_id {
        call.callee_id
    } else {
        call.caller_id
    };

    send_call_end(
        &state,
        peer_id,
        CallEndData {
            call_id,
            reason: req.reason.as_str().to_string(),
            duration_seconds: call.duration_seconds.map(|d| d as u32),
        },
    )
    .await;

    if let Some(conv) = state
        .db
        .find_dm_conversation(call.caller_id, call.callee_id)
        .await?
    {
        if !state.db.has_call_message(call_id, "call_ended").await? {
            let message = state
                .db
                .create_call_event_message(
                    conv.id,
                    call.caller_id,
                    "call_ended",
                    call_id,
                    call.duration_seconds,
                )
                .await?;

            send_new_message(
                &state,
                conv.id,
                NewMessageData {
                    id: message.id,
                    conversation_id: conv.id,
                    sender_id: call.caller_id,
                    encrypted_content: vec![],
                    signature: vec![],
                    reply_to_id: None,
                    expires_at: None,
                    sender_chain_id: None,
                    sender_chain_iteration: None,
                    message_type: "call_ended".to_string(),
                    call_id: Some(call_id),
                    call_duration_seconds: call.duration_seconds,
                    pinned_at: None,
                    created_at: message.created_at,
                },
                None,
            )
            .await;
        }
    }

    Ok(Json(CallResponse::from(call)))
}

async fn get_call_history(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
) -> Result<Json<Vec<CallWithPeerInfo>>> {
    let calls = state.db.get_call_history(user_id, 50, 0).await?;

    let mut result = Vec::with_capacity(calls.len());
    for call in calls {
        if let Some((c, username, display_name, avatar_url)) =
            state.db.get_call_with_peer_info(call.id, user_id).await?
        {
            result.push(CallWithPeerInfo {
                call: CallResponse::from(c),
                peer_username: username,
                peer_display_name: display_name,
                peer_avatar_url: avatar_url,
            });
        }
    }

    Ok(Json(result))
}

async fn get_active_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
) -> Result<Json<Option<CallWithPeerInfo>>> {
    let call = state.db.get_active_call_for_user(user_id).await?;

    match call {
        Some(c) => {
            if let Some((call, username, display_name, avatar_url)) =
                state.db.get_call_with_peer_info(c.id, user_id).await?
            {
                Ok(Json(Some(CallWithPeerInfo {
                    call: CallResponse::from(call),
                    peer_username: username,
                    peer_display_name: display_name,
                    peer_avatar_url: avatar_url,
                })))
            } else {
                Ok(Json(None))
            }
        }
        None => Ok(Json(None)),
    }
}

const REJOIN_WINDOW_SECONDS: i64 = 300;

async fn leave_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<CallResponse>> {
    let call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;
    if status != CallStatus::Active {
        return Err(AppError::BadRequest("Can only leave an active call".into()));
    }

    if call.has_user_left(user_id) {
        return Err(AppError::BadRequest(
            "You have already left this call".into(),
        ));
    }

    let call = state.db.leave_call(call_id, user_id).await?;

    let peer_id = call
        .peer_id(user_id)
        .ok_or_else(|| AppError::BadRequest("No peer found".into()))?;

    send_call_leave(
        &state,
        peer_id,
        CallLeaveData {
            call_id,
            user_id,
            left_at: Utc::now(),
        },
    )
    .await;

    if call.caller_left_at.is_some() && call.callee_left_at.is_some() {
        if let Some(ended_call) = state
            .db
            .try_end_call(call_id, CallStatus::Ended, CallEndReason::Normal)
            .await?
        {
            send_call_end(
                &state,
                peer_id,
                CallEndData {
                    call_id,
                    reason: "normal".to_string(),
                    duration_seconds: ended_call.duration_seconds.map(|d| d as u32),
                },
            )
            .await;

            if let Some(conv) = state
                .db
                .find_dm_conversation(call.caller_id, call.callee_id)
                .await?
            {
                if !state.db.has_call_message(call_id, "call_ended").await? {
                    let message = state
                        .db
                        .create_call_event_message(
                            conv.id,
                            call.caller_id,
                            "call_ended",
                            call_id,
                            ended_call.duration_seconds,
                        )
                        .await?;

                    send_new_message(
                        &state,
                        conv.id,
                        NewMessageData {
                            id: message.id,
                            conversation_id: conv.id,
                            sender_id: call.caller_id,
                            encrypted_content: vec![],
                            signature: vec![],
                            reply_to_id: None,
                            expires_at: None,
                            sender_chain_id: None,
                            sender_chain_iteration: None,
                            message_type: "call_ended".to_string(),
                            call_id: Some(call_id),
                            call_duration_seconds: ended_call.duration_seconds,
                            pinned_at: None,
                            created_at: message.created_at,
                        },
                        None,
                    )
                    .await;
                }
            }
        }
    }

    Ok(Json(CallResponse::from(call)))
}

async fn rejoin_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<RelayCredentials>> {
    let call = state
        .db
        .get_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;
    if status != CallStatus::Active {
        return Err(AppError::BadRequest("Call is not active".into()));
    }

    if !call.is_rejoinable(user_id, REJOIN_WINDOW_SECONDS) {
        return Err(AppError::BadRequest("Call is not rejoinable".into()));
    }

    let updated_call = state.db.rejoin_call(call_id, user_id).await?;

    let relay_config = &state.config.calls.relay;
    let expires_at = Utc::now() + Duration::hours(3);

    let is_caller = call.is_caller(user_id);
    let rejoiner_token = generate_relay_token(
        &relay_config.token_secret,
        call_id,
        user_id,
        is_caller,
        expires_at,
    )?;

    let relay_endpoint = format!("{}:{}", relay_config.public_host, relay_config.bind_port);

    let peer_id = call
        .peer_id(user_id)
        .ok_or_else(|| AppError::BadRequest("No peer found".into()))?;

    if !updated_call.peer_has_left(user_id) {
        let peer_token = generate_relay_token(
            &relay_config.token_secret,
            call_id,
            peer_id,
            !is_caller,
            expires_at,
        )?;

        send_call_rejoin(
            &state,
            peer_id,
            CallRejoinData {
                call_id,
                user_id,
                relay_endpoint: relay_endpoint.clone(),
                relay_token: peer_token,
                expires_at,
            },
        )
        .await;
    }

    Ok(Json(RelayCredentials {
        call_id,
        relay_endpoint,
        relay_token: rejoiner_token,
        expires_at,
    }))
}

async fn get_rejoinable_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
) -> Result<Json<Option<CallWithPeerInfo>>> {
    let call = state
        .db
        .get_rejoinable_call(user_id, REJOIN_WINDOW_SECONDS)
        .await?;

    match call {
        Some(c) => {
            if let Some((call, username, display_name, avatar_url)) =
                state.db.get_call_with_peer_info(c.id, user_id).await?
            {
                Ok(Json(Some(CallWithPeerInfo {
                    call: CallResponse::from(call),
                    peer_username: username,
                    peer_display_name: display_name,
                    peer_avatar_url: avatar_url,
                })))
            } else {
                Ok(Json(None))
            }
        }
        None => Ok(Json(None)),
    }
}

fn generate_relay_token(
    secret: &str,
    call_id: Uuid,
    participant_id: Uuid,
    is_caller: bool,
    expires_at: chrono::DateTime<Utc>,
) -> std::result::Result<Vec<u8>, AppError> {
    if secret.is_empty() {
        return Err(AppError::BadRequest(
            "CALLS_RELAY_TOKEN_SECRET not configured".into(),
        ));
    }

    let secret_bytes = secret.as_bytes().to_vec();

    let mut mac = HmacSha256::new_from_slice(&secret_bytes).expect("HMAC can take key of any size");

    mac.update(call_id.as_bytes());
    mac.update(participant_id.as_bytes());
    mac.update(&[if is_caller { 1 } else { 0 }]);
    mac.update(&expires_at.timestamp().to_le_bytes());

    let signature = mac.finalize().into_bytes();

    let mut token = Vec::with_capacity(16 + 16 + 1 + 8 + 32);
    token.extend_from_slice(call_id.as_bytes());
    token.extend_from_slice(participant_id.as_bytes());
    token.push(if is_caller { 1 } else { 0 });
    token.extend_from_slice(&expires_at.timestamp().to_le_bytes());
    token.extend_from_slice(&signature);

    Ok(token)
}

pub fn _verify_relay_token(
    secret: &str,
    token: &[u8],
) -> Option<(Uuid, Uuid, bool, chrono::DateTime<Utc>)> {
    if token.len() != 16 + 16 + 1 + 8 + 32 {
        return None;
    }

    let call_id = Uuid::from_slice(&token[0..16]).ok()?;
    let participant_id = Uuid::from_slice(&token[16..32]).ok()?;
    let is_caller = token[32] == 1;
    let timestamp_bytes: [u8; 8] = token[33..41].try_into().ok()?;
    let timestamp = i64::from_le_bytes(timestamp_bytes);
    let expires_at = chrono::DateTime::from_timestamp(timestamp, 0)?;

    let signature = &token[41..];

    let secret_bytes = if secret.is_empty() {
        vec![0u8; 32]
    } else {
        secret.as_bytes().to_vec()
    };

    let mut mac = HmacSha256::new_from_slice(&secret_bytes).ok()?;
    mac.update(call_id.as_bytes());
    mac.update(participant_id.as_bytes());
    mac.update(&[if is_caller { 1 } else { 0 }]);
    mac.update(&expires_at.timestamp().to_le_bytes());

    mac.verify_slice(signature).ok()?;

    if Utc::now() > expires_at {
        return None;
    }

    Some((call_id, participant_id, is_caller, expires_at))
}
