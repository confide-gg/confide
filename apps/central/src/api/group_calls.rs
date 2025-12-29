use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::middleware::AuthUser;
use crate::error::{AppError, Result};
use crate::models::{
    ActiveGroupCallResponse, CallStatus, CreateGroupCallRequest, GroupCallMuteRequest,
    GroupCallParticipantInfo, GroupCallResponse, JoinGroupCallRequest, ParticipantStatus,
    RelayCredentials, SendSenderKeyRequest,
};
use crate::ws::{
    send_group_call_ended, send_group_call_mute_update, send_group_call_participant_joined,
    send_group_call_participant_left, send_group_call_ring, send_group_call_sender_key,
    send_new_message, GroupCallEndedData, GroupCallMuteUpdateData, GroupCallParticipantJoinedData,
    GroupCallParticipantLeftData, GroupCallRingData, GroupCallSenderKeyData, NewMessageData,
};
use crate::AppState;

const REJOIN_WINDOW_SECONDS: i64 = 300;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_group_call))
        .route("/{call_id}", get(get_group_call))
        .route("/{call_id}/join", post(join_group_call))
        .route("/{call_id}/rejoin", post(rejoin_group_call))
        .route("/{call_id}/refresh-token", post(refresh_relay_token))
        .route("/{call_id}/decline", post(decline_group_call))
        .route("/{call_id}/leave", post(leave_group_call))
        .route("/{call_id}/end", post(end_group_call))
        .route("/{call_id}/participants", get(get_participants))
        .route("/{call_id}/mute", post(update_mute))
        .route("/{call_id}/sender-key", post(send_sender_key))
        .route("/active", get(get_active_group_call))
        .route(
            "/conversation/{conversation_id}",
            get(get_active_call_for_conversation),
        )
}

async fn create_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Json(req): Json<CreateGroupCallRequest>,
) -> Result<Json<GroupCallResponse>> {
    if !state.config.calls.enabled {
        return Err(AppError::BadRequest("Calls are not enabled".into()));
    }

    let conversation = state
        .db
        .get_conversation(req.conversation_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Conversation not found".into()))?;

    if conversation.conversation_type != "group" {
        return Err(AppError::BadRequest(
            "Can only create group calls in group conversations".into(),
        ));
    }

    let is_member = state
        .db
        .get_conversation_routing(req.conversation_id, user_id)
        .await?
        .is_some();

    if !is_member {
        return Err(AppError::Forbidden);
    }

    let call = state
        .db
        .create_group_call(req.call_id, req.conversation_id, user_id)
        .await?;

    let participants = state
        .db
        .get_group_call_participants_with_info(call.id)
        .await?;

    let initiator_profile = state.db.get_profile(user_id).await?;
    let initiator_user = state
        .db
        .get_user_by_id(user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let group_metadata = state
        .db
        .get_conversation(req.conversation_id)
        .await?
        .and_then(|c| c.encrypted_metadata);

    for participant in &participants {
        if participant.user_id != user_id && participant.status == ParticipantStatus::Ringing {
            send_group_call_ring(
                &state,
                participant.user_id,
                GroupCallRingData {
                    call_id: call.id,
                    conversation_id: req.conversation_id,
                    initiator_id: user_id,
                    initiator_username: initiator_user.username.clone(),
                    initiator_display_name: initiator_profile
                        .as_ref()
                        .and_then(|p| p.display_name.clone()),
                    initiator_avatar_url: initiator_profile
                        .as_ref()
                        .and_then(|p| p.avatar_url.clone()),
                    participant_count: participants.len() as i64,
                    encrypted_group_metadata: group_metadata.clone(),
                    announcement: req.announcement.clone(),
                    signature: req.signature.clone(),
                    created_at: call.created_at,
                },
            )
            .await;
        }
    }

    let message = state
        .db
        .create_call_event_message(
            req.conversation_id,
            user_id,
            "group_call_started",
            call.id,
            None,
        )
        .await?;

    send_new_message(
        &state,
        req.conversation_id,
        NewMessageData {
            id: message.id,
            conversation_id: req.conversation_id,
            sender_id: user_id,
            encrypted_content: vec![],
            signature: vec![],
            reply_to_id: None,
            expires_at: None,
            sender_chain_id: None,
            sender_chain_iteration: None,
            message_type: "group_call_started".to_string(),
            call_id: Some(call.id),
            call_duration_seconds: None,
            pinned_at: None,
            created_at: message.created_at,
        },
        None,
    )
    .await;

    Ok(Json(GroupCallResponse {
        id: call.id,
        conversation_id: req.conversation_id,
        initiator_id: user_id,
        status: CallStatus::Ringing,
        participants,
        created_at: call.created_at,
        ring_started_at: call.ring_started_at,
        connected_at: call.connected_at,
        ended_at: call.ended_at,
    }))
}

async fn get_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<GroupCallResponse>> {
    let call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let participants = state
        .db
        .get_group_call_participants_with_info(call_id)
        .await?;

    let initiator_id = call
        .initiator_id
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Group call missing initiator")))?;

    let conversation_id = call
        .conversation_id
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Group call missing conversation")))?;

    Ok(Json(GroupCallResponse {
        id: call.id,
        conversation_id,
        initiator_id,
        status: call.get_status().unwrap_or(CallStatus::Ended),
        participants,
        created_at: call.created_at,
        ring_started_at: call.ring_started_at,
        connected_at: call.connected_at,
        ended_at: call.ended_at,
    }))
}

async fn join_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
    Json(req): Json<JoinGroupCallRequest>,
) -> Result<Json<RelayCredentials>> {
    let call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let status = call
        .get_status()
        .ok_or_else(|| AppError::BadRequest("Invalid call status".into()))?;

    if !matches!(status, CallStatus::Ringing | CallStatus::Active) {
        return Err(AppError::BadRequest("Call is not joinable".into()));
    }

    let participant = state
        .db
        .join_group_call(call_id, user_id, Some(&req.encrypted_sender_key_bundle))
        .await?;

    let user_profile = state.db.get_profile(user_id).await?;
    let user = state
        .db
        .get_user_by_id(user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let active_participant_ids = state.db.get_active_group_call_member_ids(call_id).await?;

    for pid in &active_participant_ids {
        if *pid != user_id {
            send_group_call_participant_joined(
                &state,
                *pid,
                GroupCallParticipantJoinedData {
                    call_id,
                    user_id,
                    username: user.username.clone(),
                    display_name: user_profile.as_ref().and_then(|p| p.display_name.clone()),
                    avatar_url: user_profile.as_ref().and_then(|p| p.avatar_url.clone()),
                    encrypted_sender_key: req.encrypted_sender_key_bundle.clone(),
                    joiner_ephemeral_public: req.joiner_ephemeral_public.clone(),
                    identity_public: req.identity_public.clone(),
                    joined_at: participant.joined_at.unwrap_or_else(Utc::now),
                },
            )
            .await;
        }
    }

    let relay_config = &state.config.calls.relay;
    let expires_at = Utc::now() + Duration::hours(3);

    let token =
        generate_group_relay_token(&relay_config.token_secret, call_id, user_id, expires_at)?;

    let relay_endpoint = format!("{}:{}", relay_config.public_host, relay_config.bind_port);

    Ok(Json(RelayCredentials {
        call_id,
        relay_endpoint,
        relay_token: token,
        expires_at,
    }))
}

async fn rejoin_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<RelayCredentials>> {
    let is_rejoinable = state
        .db
        .is_group_call_rejoinable(call_id, user_id, REJOIN_WINDOW_SECONDS)
        .await?;

    if !is_rejoinable {
        return Err(AppError::BadRequest("Call is not rejoinable".into()));
    }

    let participant = state
        .db
        .rejoin_group_call(call_id, user_id, REJOIN_WINDOW_SECONDS)
        .await?;

    let user_profile = state.db.get_profile(user_id).await?;
    let user = state
        .db
        .get_user_by_id(user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let active_participant_ids = state.db.get_active_group_call_member_ids(call_id).await?;

    for pid in &active_participant_ids {
        if *pid != user_id {
            send_group_call_participant_joined(
                &state,
                *pid,
                GroupCallParticipantJoinedData {
                    call_id,
                    user_id,
                    username: user.username.clone(),
                    display_name: user_profile.as_ref().and_then(|p| p.display_name.clone()),
                    avatar_url: user_profile.as_ref().and_then(|p| p.avatar_url.clone()),
                    encrypted_sender_key: Vec::new(),
                    joiner_ephemeral_public: Vec::new(),
                    identity_public: Vec::new(),
                    joined_at: participant.joined_at.unwrap_or_else(Utc::now),
                },
            )
            .await;
        }
    }

    let relay_config = &state.config.calls.relay;
    let expires_at = Utc::now() + Duration::hours(3);

    let token =
        generate_group_relay_token(&relay_config.token_secret, call_id, user_id, expires_at)?;

    let relay_endpoint = format!("{}:{}", relay_config.public_host, relay_config.bind_port);

    Ok(Json(RelayCredentials {
        call_id,
        relay_endpoint,
        relay_token: token,
        expires_at,
    }))
}

async fn refresh_relay_token(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<RelayCredentials>> {
    let participant = state
        .db
        .get_group_call_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Participant not found".into()))?;

    if participant.status != "active" {
        return Err(AppError::BadRequest(
            "Can only refresh token for active participants".into(),
        ));
    }

    let call = state
        .db
        .get_group_call(call_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let status = call.get_status();
    if !matches!(status, Some(CallStatus::Active)) {
        return Err(AppError::BadRequest("Call is not active".into()));
    }

    let relay_config = &state.config.calls.relay;
    let expires_at = Utc::now() + Duration::hours(3);

    let token =
        generate_group_relay_token(&relay_config.token_secret, call_id, user_id, expires_at)?;

    let relay_endpoint = format!("{}:{}", relay_config.public_host, relay_config.bind_port);

    Ok(Json(RelayCredentials {
        call_id,
        relay_endpoint,
        relay_token: token,
        expires_at,
    }))
}

async fn decline_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<StatusCode> {
    let _call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    state.db.decline_group_call(call_id, user_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn leave_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<StatusCode> {
    let call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let conversation_id = call
        .conversation_id
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Group call missing conversation")))?;

    let active_participant_ids = state.db.get_active_group_call_member_ids(call_id).await?;

    let call_ended = state.db.leave_group_call(call_id, user_id).await?;

    for pid in &active_participant_ids {
        if *pid != user_id {
            send_group_call_participant_left(
                &state,
                *pid,
                GroupCallParticipantLeftData {
                    call_id,
                    user_id,
                    left_at: Utc::now(),
                },
            )
            .await;
        }
    }

    if call_ended {
        let all_member_ids = state.db.get_group_call_member_ids(call_id).await?;
        for pid in all_member_ids {
            if pid != user_id {
                send_group_call_ended(
                    &state,
                    pid,
                    GroupCallEndedData {
                        call_id,
                        conversation_id,
                        reason: "all_left".to_string(),
                    },
                )
                .await;
            }
        }

        let ended_call = state.db.get_group_call(call_id).await?;
        if !state
            .db
            .has_call_message(call_id, "group_call_ended")
            .await?
        {
            let initiator_id = call.initiator_id.unwrap_or(user_id);
            let duration_seconds = ended_call.as_ref().and_then(|c| c.duration_seconds);
            let message = state
                .db
                .create_call_event_message(
                    conversation_id,
                    initiator_id,
                    "group_call_ended",
                    call_id,
                    duration_seconds,
                )
                .await?;

            send_new_message(
                &state,
                conversation_id,
                NewMessageData {
                    id: message.id,
                    conversation_id,
                    sender_id: initiator_id,
                    encrypted_content: vec![],
                    signature: vec![],
                    reply_to_id: None,
                    expires_at: None,
                    sender_chain_id: None,
                    sender_chain_iteration: None,
                    message_type: "group_call_ended".to_string(),
                    call_id: Some(call_id),
                    call_duration_seconds: duration_seconds,
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

async fn end_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<StatusCode> {
    let call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    if call.initiator_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }

    let conversation_id = call
        .conversation_id
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Group call missing conversation")))?;

    let all_member_ids = state.db.get_group_call_member_ids(call_id).await?;

    let ended_call = state.db.end_group_call(call_id).await?;

    for pid in all_member_ids {
        if pid != user_id {
            send_group_call_ended(
                &state,
                pid,
                GroupCallEndedData {
                    call_id,
                    conversation_id,
                    reason: "ended_by_initiator".to_string(),
                },
            )
            .await;
        }
    }

    if !state
        .db
        .has_call_message(call_id, "group_call_ended")
        .await?
    {
        let message = state
            .db
            .create_call_event_message(
                conversation_id,
                user_id,
                "group_call_ended",
                call_id,
                ended_call.duration_seconds,
            )
            .await?;

        send_new_message(
            &state,
            conversation_id,
            NewMessageData {
                id: message.id,
                conversation_id,
                sender_id: user_id,
                encrypted_content: vec![],
                signature: vec![],
                reply_to_id: None,
                expires_at: None,
                sender_chain_id: None,
                sender_chain_iteration: None,
                message_type: "group_call_ended".to_string(),
                call_id: Some(call_id),
                call_duration_seconds: ended_call.duration_seconds,
                pinned_at: None,
                created_at: message.created_at,
            },
            None,
        )
        .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn get_participants(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
) -> Result<Json<Vec<GroupCallParticipantInfo>>> {
    let _call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let participants = state.db.get_active_participants_with_info(call_id).await?;

    Ok(Json(participants))
}

async fn update_mute(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
    Json(req): Json<GroupCallMuteRequest>,
) -> Result<StatusCode> {
    let _call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    state
        .db
        .update_group_call_mute(call_id, user_id, req.is_muted)
        .await?;

    let active_participant_ids = state.db.get_active_group_call_member_ids(call_id).await?;

    for pid in active_participant_ids {
        if pid != user_id {
            send_group_call_mute_update(
                &state,
                pid,
                GroupCallMuteUpdateData {
                    call_id,
                    user_id,
                    is_muted: req.is_muted,
                },
            )
            .await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn send_sender_key(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(call_id): Path<Uuid>,
    Json(req): Json<SendSenderKeyRequest>,
) -> Result<StatusCode> {
    let _call = state
        .db
        .get_group_call_for_participant(call_id, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

    let is_target_participant = state
        .db
        .get_group_call_for_participant(call_id, req.target_user_id)
        .await?
        .is_some();

    if !is_target_participant {
        return Err(AppError::BadRequest(
            "Target user is not a participant".into(),
        ));
    }

    send_group_call_sender_key(
        &state,
        req.target_user_id,
        GroupCallSenderKeyData {
            call_id,
            from_user_id: user_id,
            encrypted_sender_key: req.encrypted_sender_key,
            sender_identity_public: req.sender_identity_public,
            sender_ephemeral_public: req.sender_ephemeral_public,
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

async fn get_active_group_call(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
) -> Result<Json<Option<GroupCallResponse>>> {
    let call = state.db.get_active_group_call_for_user(user_id).await?;

    match call {
        Some(c) => {
            let participants = state.db.get_group_call_participants_with_info(c.id).await?;

            let initiator_id = c.initiator_id.ok_or_else(|| {
                AppError::Internal(anyhow::anyhow!("Group call missing initiator"))
            })?;

            let conversation_id = c.conversation_id.ok_or_else(|| {
                AppError::Internal(anyhow::anyhow!("Group call missing conversation"))
            })?;

            Ok(Json(Some(GroupCallResponse {
                id: c.id,
                conversation_id,
                initiator_id,
                status: c.get_status().unwrap_or(CallStatus::Ended),
                participants,
                created_at: c.created_at,
                ring_started_at: c.ring_started_at,
                connected_at: c.connected_at,
                ended_at: c.ended_at,
            })))
        }
        None => Ok(Json(None)),
    }
}

async fn get_active_call_for_conversation(
    State(state): State<Arc<AppState>>,
    AuthUser { user_id, .. }: AuthUser,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Option<ActiveGroupCallResponse>>> {
    let is_member = state
        .db
        .get_conversation_routing(conversation_id, user_id)
        .await?
        .is_some();

    if !is_member {
        return Err(AppError::Forbidden);
    }

    let call = state
        .db
        .get_active_group_call_for_conversation(conversation_id)
        .await?;

    match call {
        Some(c) => {
            let participant_count = state.db.get_group_call_participant_count(c.id).await?;

            let initiator_id = c.initiator_id.ok_or_else(|| {
                AppError::Internal(anyhow::anyhow!("Group call missing initiator"))
            })?;

            Ok(Json(Some(ActiveGroupCallResponse {
                call_id: c.id,
                conversation_id,
                initiator_id,
                status: c.get_status().unwrap_or(CallStatus::Ended),
                participant_count,
                created_at: c.created_at,
            })))
        }
        None => Ok(Json(None)),
    }
}

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn generate_group_relay_token(
    secret: &str,
    call_id: Uuid,
    participant_id: Uuid,
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
    mac.update(&[2]);
    mac.update(&expires_at.timestamp().to_le_bytes());

    let signature = mac.finalize().into_bytes();

    let mut token = Vec::with_capacity(16 + 16 + 1 + 8 + 32);
    token.extend_from_slice(call_id.as_bytes());
    token.extend_from_slice(participant_id.as_bytes());
    token.push(2);
    token.extend_from_slice(&expires_at.timestamp().to_le_bytes());
    token.extend_from_slice(&signature);

    Ok(token)
}
