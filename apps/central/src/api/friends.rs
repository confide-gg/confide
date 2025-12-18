use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::db::cache;
use crate::error::{AppError, Result};
use crate::models::{FriendRequest, PublicUser};
use crate::ws::{
    FriendAcceptedData, FriendRemovedData, FriendRequestData, PresenceData, WsMessage,
};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_friends))
        .route("/", put(update_friends))
        .route("/search", get(search_users))
        .route("/requests", get(get_friend_requests))
        .route("/requests/sent", get(get_sent_friend_requests))
        .route("/requests", post(send_friend_request))
        .route("/requests/{id}/accept", post(accept_friend_request))
        .route("/requests/{id}", delete(reject_friend_request))
        .route("/requests/{id}/cancel", delete(cancel_friend_request))
}

#[derive(Debug, Serialize)]
pub struct FriendsResponse {
    pub encrypted_friends: Vec<u8>,
}

pub async fn get_friends(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<FriendsResponse>> {
    let friends = state
        .db
        .get_user_friends(auth.user_id)
        .await?
        .map(|f| f.encrypted_friends)
        .unwrap_or_default();

    Ok(Json(FriendsResponse {
        encrypted_friends: friends,
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFriendsRequest {
    pub encrypted_friends: Vec<u8>,
    pub removed_friend_id: Option<Uuid>,
}

pub async fn update_friends(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<UpdateFriendsRequest>,
) -> Result<Json<serde_json::Value>> {
    state
        .db
        .update_user_friends(auth.user_id, req.encrypted_friends)
        .await?;

    let cache_key = format!("user:convos:{}", auth.user_id);
    let _ = cache::invalidate_cache(&state.redis, &cache_key).await;

    if let Some(removed_id) = req.removed_friend_id {
        let removed_cache_key = format!("user:convos:{}", removed_id);
        let _ = cache::invalidate_cache(&state.redis, &removed_cache_key).await;
        let ws_msg = WsMessage::FriendRemoved(FriendRemovedData {
            by_user_id: auth.user_id,
        });
        if let Ok(json) = serde_json::to_string(&ws_msg) {
            let channel = format!("user:{}", removed_id);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

pub async fn search_users(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<PublicUser>>> {
    if query.q.len() < 2 {
        return Err(AppError::BadRequest("query must be exact username".into()));
    }

    let users = state.db.search_users(&query.q, query.limit.min(50)).await?;
    Ok(Json(users))
}

#[derive(Debug, Serialize)]
pub struct FriendRequestResponse {
    pub id: Uuid,
    pub from_user: PublicUser,
    pub encrypted_message: Option<Vec<u8>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_friend_requests(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Vec<FriendRequestResponse>>> {
    let requests = state.db.get_friend_requests_for_user(auth.user_id).await?;

    let mut responses = Vec::new();
    for req in requests {
        if let Some(from_user) = state.db.get_public_user(req.from_user_id).await? {
            responses.push(FriendRequestResponse {
                id: req.id,
                from_user,
                encrypted_message: req.encrypted_message,
                created_at: req.created_at,
            });
        }
    }

    Ok(Json(responses))
}

#[derive(Debug, Deserialize)]
pub struct SendFriendRequestBody {
    pub to_user_id: Uuid,
    pub encrypted_message: Option<Vec<u8>>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum SendFriendRequestResponse {
    #[serde(rename = "request_sent")]
    RequestSent { request: FriendRequest },
    #[serde(rename = "mutual_accepted")]
    MutualAccepted {
        friend_user_id: Uuid,
        friend_username: String,
    },
}

pub async fn send_friend_request(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<SendFriendRequestBody>,
) -> Result<Json<SendFriendRequestResponse>> {
    if body.to_user_id == auth.user_id {
        return Err(AppError::BadRequest(
            "cannot send friend request to yourself".into(),
        ));
    }

    let to_user = state
        .db
        .get_user_by_id(body.to_user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    let reverse_request = state
        .db
        .get_reverse_friend_request(auth.user_id, body.to_user_id)
        .await?;

    if let Some(_reverse) = reverse_request {
        state
            .db
            .delete_friend_requests_between(auth.user_id, body.to_user_id)
            .await?;

        let sender_user = state
            .db
            .get_public_user(auth.user_id)
            .await?
            .ok_or(AppError::UserNotFound)?;

        let cache_key_a = format!("user:convos:{}", auth.user_id);
        let _ = cache::invalidate_cache(&state.redis, &cache_key_a).await;
        let cache_key_b = format!("user:convos:{}", body.to_user_id);
        let _ = cache::invalidate_cache(&state.redis, &cache_key_b).await;

        let ws_msg_to_other = WsMessage::FriendAccepted(FriendAcceptedData {
            by_user_id: auth.user_id,
            by_username: sender_user.username.clone(),
        });
        if let Ok(json) = serde_json::to_string(&ws_msg_to_other) {
            let channel = format!("user:{}", body.to_user_id);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }

        let ws_msg_to_sender = WsMessage::FriendAccepted(FriendAcceptedData {
            by_user_id: body.to_user_id,
            by_username: to_user.username.clone(),
        });
        if let Ok(json) = serde_json::to_string(&ws_msg_to_sender) {
            let channel = format!("user:{}", auth.user_id);
            let _ = publish_to_redis(&state.redis, &channel, &json).await;
        }

        send_presence_to_new_friends(&state, auth.user_id, body.to_user_id).await;

        return Ok(Json(SendFriendRequestResponse::MutualAccepted {
            friend_user_id: body.to_user_id,
            friend_username: to_user.username,
        }));
    }

    let request = state
        .db
        .create_friend_request(
            auth.user_id,
            body.to_user_id,
            body.encrypted_message.clone(),
        )
        .await?;

    let ws_msg = WsMessage::FriendRequest(FriendRequestData {
        id: request.id,
        from_user_id: auth.user_id,
        encrypted_message: body.encrypted_message,
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("user:{}", body.to_user_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    Ok(Json(SendFriendRequestResponse::RequestSent { request }))
}

async fn publish_to_redis(
    redis: &redis::Client,
    channel: &str,
    message: &str,
) -> std::result::Result<(), redis::RedisError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    redis::cmd("PUBLISH")
        .arg(channel)
        .arg(message)
        .query_async(&mut conn)
        .await
}

async fn send_presence_to_new_friends(state: &AppState, user_a: Uuid, user_b: Uuid) {
    let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await else {
        return;
    };

    let user_ids = vec![user_a.to_string(), user_b.to_string()];
    let online_statuses: std::result::Result<Vec<bool>, _> = redis::cmd("SMISMEMBER")
        .arg("online_users")
        .arg(&user_ids)
        .query_async(&mut conn)
        .await;

    let Ok(statuses) = online_statuses else {
        return;
    };

    let user_a_online = statuses.first().copied().unwrap_or(false);
    let user_b_online = statuses.get(1).copied().unwrap_or(false);

    if user_a_online {
        let (status, custom_status) = state
            .db
            .get_user_presence_data(user_a)
            .await
            .unwrap_or(("online".to_string(), None));

        let presence_msg = WsMessage::Presence(PresenceData {
            user_id: user_a,
            online: true,
            status: Some(status),
            custom_status,
        });
        if let Ok(json) = serde_json::to_string(&presence_msg) {
            let _ = publish_to_redis(&state.redis, &format!("presence:{}", user_a), &json).await;
        }
    }

    if user_b_online {
        let (status, custom_status) = state
            .db
            .get_user_presence_data(user_b)
            .await
            .unwrap_or(("online".to_string(), None));

        let presence_msg = WsMessage::Presence(PresenceData {
            user_id: user_b,
            online: true,
            status: Some(status),
            custom_status,
        });
        if let Ok(json) = serde_json::to_string(&presence_msg) {
            let _ = publish_to_redis(&state.redis, &format!("presence:{}", user_b), &json).await;
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct AcceptFriendRequestBody {
    pub encrypted_friends: Vec<u8>,
}

pub async fn accept_friend_request(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(request_id): Path<Uuid>,
    Json(body): Json<AcceptFriendRequestBody>,
) -> Result<Json<serde_json::Value>> {
    let friend_request = state
        .db
        .get_friend_request(request_id)
        .await?
        .ok_or(AppError::FriendRequestNotFound)?;

    if friend_request.to_user_id != auth.user_id {
        return Err(AppError::FriendRequestNotFound);
    }

    let accepting_user = state
        .db
        .get_public_user(auth.user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    state
        .db
        .update_user_friends(auth.user_id, body.encrypted_friends)
        .await?;

    state.db.delete_friend_request(request_id).await?;

    let accepter_cache_key = format!("user:convos:{}", auth.user_id);
    let _ = cache::invalidate_cache(&state.redis, &accepter_cache_key).await;

    let requester_cache_key = format!("user:convos:{}", friend_request.from_user_id);
    let _ = cache::invalidate_cache(&state.redis, &requester_cache_key).await;

    let ws_msg = WsMessage::FriendAccepted(FriendAcceptedData {
        by_user_id: auth.user_id,
        by_username: accepting_user.username.clone(),
    });
    if let Ok(json) = serde_json::to_string(&ws_msg) {
        let channel = format!("user:{}", friend_request.from_user_id);
        let _ = publish_to_redis(&state.redis, &channel, &json).await;
    }

    send_presence_to_new_friends(&state, auth.user_id, friend_request.from_user_id).await;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn reject_friend_request(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(request_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let friend_request = state
        .db
        .get_friend_request(request_id)
        .await?
        .ok_or(AppError::FriendRequestNotFound)?;

    if friend_request.to_user_id != auth.user_id {
        return Err(AppError::FriendRequestNotFound);
    }

    state.db.delete_friend_request(request_id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn get_sent_friend_requests(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<Vec<FriendRequestResponse>>> {
    let requests = state.db.get_sent_friend_requests(auth.user_id).await?;

    let mut responses = Vec::new();
    for req in requests {
        if let Some(to_user) = state.db.get_public_user(req.to_user_id).await? {
            responses.push(FriendRequestResponse {
                id: req.id,
                from_user: to_user,
                encrypted_message: req.encrypted_message,
                created_at: req.created_at,
            });
        }
    }

    Ok(Json(responses))
}

pub async fn cancel_friend_request(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(request_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let friend_request = state
        .db
        .get_friend_request(request_id)
        .await?
        .ok_or(AppError::FriendRequestNotFound)?;

    if friend_request.from_user_id != auth.user_id {
        return Err(AppError::FriendRequestNotFound);
    }

    state.db.delete_friend_request(request_id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
