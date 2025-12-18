use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::AppState;

use super::middleware::AuthUser;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/connect", get(spotify_connect))
        .route("/callback", get(spotify_callback))
        .route("/disconnect", delete(spotify_disconnect))
        .route("/status", get(spotify_status))
        .route("/current-track", get(get_current_track))
        .route("/refresh-activity", post(refresh_activity_now))
}

#[derive(Debug, Deserialize)]
pub struct SpotifyCallbackQuery {
    code: String,
    state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SpotifyConnectResponse {
    auth_url: String,
}

#[derive(Debug, Serialize)]
pub struct SpotifyStatusResponse {
    connected: bool,
    display_in_profile: bool,
}

#[derive(Debug, Deserialize)]
struct SpotifyTokenResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: String,
    expires_in: i64,
    refresh_token: Option<String>,
    scope: String,
}

pub async fn spotify_connect(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<SpotifyConnectResponse>> {
    let client_id = std::env::var("SPOTIFY_CLIENT_ID")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("SPOTIFY_CLIENT_ID not configured")))?;
    let redirect_uri = std::env::var("SPOTIFY_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3000/api/spotify/callback".to_string());

    let state_param = Uuid::new_v4().to_string();

    let mut redis_conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis connection failed: {}", e)))?;

    redis::cmd("SET")
        .arg(format!("spotify_oauth:{}", state_param))
        .arg(auth.user_id.to_string())
        .arg("EX")
        .arg(600)
        .query_async::<()>(&mut redis_conn)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to store OAuth state: {}", e)))?;

    let scopes = "user-read-currently-playing user-read-playback-state";
    let auth_url = format!(
        "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&scope={}&state={}",
        client_id,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(scopes),
        urlencoding::encode(&state_param)
    );

    Ok(Json(SpotifyConnectResponse { auth_url }))
}

pub async fn spotify_callback(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SpotifyCallbackQuery>,
) -> Result<String> {
    let state_param = query
        .state
        .ok_or_else(|| AppError::BadRequest("Missing state parameter".into()))?;

    let mut redis_conn = state
        .redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Redis connection failed: {}", e)))?;

    let user_id_str: Option<String> = redis::cmd("GETDEL")
        .arg(format!("spotify_oauth:{}", state_param))
        .query_async::<Option<String>>(&mut redis_conn)
        .await
        .map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to retrieve OAuth state: {}", e))
        })?;

    let user_id_str = user_id_str
        .ok_or_else(|| AppError::BadRequest("Invalid or expired state parameter".into()))?;

    let user_id = Uuid::parse_str(&user_id_str)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Invalid user ID in state")))?;

    let client_id = std::env::var("SPOTIFY_CLIENT_ID")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("SPOTIFY_CLIENT_ID not configured")))?;
    let client_secret = std::env::var("SPOTIFY_CLIENT_SECRET")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("SPOTIFY_CLIENT_SECRET not configured")))?;
    let redirect_uri = std::env::var("SPOTIFY_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3000/api/spotify/callback".to_string());

    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("code", &query.code),
        ("redirect_uri", &redirect_uri),
    ];

    let response = client
        .post("https://accounts.spotify.com/api/token")
        .basic_auth(&client_id, Some(&client_secret))
        .form(&params)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to exchange code: {}", e)))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Spotify token exchange failed: {}",
            error_text
        )));
    }

    let token_response: SpotifyTokenResponse = response.json().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse token response: {}", e))
    })?;

    let refresh_token = token_response
        .refresh_token
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("No refresh token provided")))?;

    let expires_at = Utc::now() + Duration::seconds(token_response.expires_in);

    state
        .db
        .upsert_spotify_integration(
            user_id,
            &token_response.access_token,
            &refresh_token,
            expires_at,
            &token_response.scope,
        )
        .await?;

    Ok("Spotify connected successfully! You can close this window.".to_string())
}

pub async fn spotify_disconnect(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<StatusCode> {
    state.db.delete_spotify_integration(auth.user_id).await?;
    state.db.delete_user_activity(auth.user_id).await?;
    crate::ws::broadcast_activity_update(&state, auth.user_id, None).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn spotify_status(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<SpotifyStatusResponse>> {
    let integration = state.db.get_spotify_integration(auth.user_id).await?;

    match integration {
        Some(integration) => Ok(Json(SpotifyStatusResponse {
            connected: true,
            display_in_profile: integration.display_in_profile,
        })),
        None => Ok(Json(SpotifyStatusResponse {
            connected: false,
            display_in_profile: false,
        })),
    }
}

#[derive(Debug, Serialize)]
pub struct CurrentTrackResponse {
    is_playing: bool,
    track_name: Option<String>,
    artist_name: Option<String>,
    album_name: Option<String>,
    album_image_url: Option<String>,
    duration_ms: Option<i64>,
    progress_ms: Option<i64>,
}

pub async fn get_current_track(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<Json<CurrentTrackResponse>> {
    let integration = state
        .db
        .get_spotify_integration(auth.user_id)
        .await?
        .ok_or(AppError::NotFound("Spotify not connected".into()))?;

    let access_token = if integration.token_expires_at < Utc::now() {
        refresh_spotify_token(&state, auth.user_id, &integration.refresh_token).await?
    } else {
        integration.access_token
    };

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.spotify.com/v1/me/player/currently-playing")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to fetch current track: {}", e)))?;

    if response.status() == StatusCode::NO_CONTENT {
        return Ok(Json(CurrentTrackResponse {
            is_playing: false,
            track_name: None,
            artist_name: None,
            album_name: None,
            album_image_url: None,
            duration_ms: None,
            progress_ms: None,
        }));
    }

    let data: serde_json::Value = response.json().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse Spotify response: {}", e))
    })?;

    let is_playing = data["is_playing"].as_bool().unwrap_or(false);
    let track_name = data["item"]["name"].as_str().map(|s| s.to_string());
    let artist_name = data["item"]["artists"][0]["name"]
        .as_str()
        .map(|s| s.to_string());
    let album_name = data["item"]["album"]["name"]
        .as_str()
        .map(|s| s.to_string());
    let album_image_url = data["item"]["album"]["images"][0]["url"]
        .as_str()
        .map(|s| s.to_string());
    let duration_ms = data["item"]["duration_ms"].as_i64();
    let progress_ms = data["progress_ms"].as_i64();

    Ok(Json(CurrentTrackResponse {
        is_playing,
        track_name,
        artist_name,
        album_name,
        album_image_url,
        duration_ms,
        progress_ms,
    }))
}

async fn refresh_spotify_token(
    state: &Arc<AppState>,
    user_id: Uuid,
    refresh_token: &str,
) -> Result<String> {
    let client_id = std::env::var("SPOTIFY_CLIENT_ID")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("SPOTIFY_CLIENT_ID not configured")))?;
    let client_secret = std::env::var("SPOTIFY_CLIENT_SECRET")
        .map_err(|_| AppError::Internal(anyhow::anyhow!("SPOTIFY_CLIENT_SECRET not configured")))?;

    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
    ];

    let response = client
        .post("https://accounts.spotify.com/api/token")
        .basic_auth(&client_id, Some(&client_secret))
        .form(&params)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to refresh token: {}", e)))?;

    let token_response: SpotifyTokenResponse = response.json().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse token response: {}", e))
    })?;

    let expires_at = Utc::now() + Duration::seconds(token_response.expires_in);
    let new_refresh_token = token_response
        .refresh_token
        .as_deref()
        .unwrap_or(refresh_token);

    state
        .db
        .upsert_spotify_integration(
            user_id,
            &token_response.access_token,
            new_refresh_token,
            expires_at,
            &token_response.scope,
        )
        .await?;

    Ok(token_response.access_token)
}

pub async fn refresh_activity_now(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> Result<StatusCode> {
    let integration = state
        .db
        .get_spotify_integration(auth.user_id)
        .await?
        .ok_or(AppError::NotFound("Spotify not connected".into()))?;

    let access_token = if integration.token_expires_at < Utc::now() {
        refresh_spotify_token(&state, auth.user_id, &integration.refresh_token).await?
    } else {
        integration.access_token
    };

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.spotify.com/v1/me/player/currently-playing")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to fetch current track: {}", e)))?;

    if response.status() == StatusCode::NO_CONTENT || !response.status().is_success() {
        state.db.delete_user_activity(auth.user_id).await?;
        crate::ws::broadcast_activity_update(&state, auth.user_id, None).await;
        return Ok(StatusCode::OK);
    }

    let data: serde_json::Value = response.json().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse Spotify response: {}", e))
    })?;

    let is_playing = data["is_playing"].as_bool().unwrap_or(false);

    if !is_playing {
        state.db.delete_user_activity(auth.user_id).await?;
        crate::ws::broadcast_activity_update(&state, auth.user_id, None).await;
        return Ok(StatusCode::OK);
    }

    let track_name = data["item"]["name"]
        .as_str()
        .unwrap_or("Unknown Track")
        .to_string();
    let artist_name = data["item"]["artists"][0]["name"]
        .as_str()
        .unwrap_or("Unknown Artist")
        .to_string();
    let album_name = data["item"]["album"]["name"]
        .as_str()
        .unwrap_or("Unknown Album")
        .to_string();
    let album_image_url = data["item"]["album"]["images"][0]["url"]
        .as_str()
        .map(|s| s.to_string());
    let duration_ms = data["item"]["duration_ms"].as_i64();
    let progress_ms = data["progress_ms"].as_i64();

    let start_timestamp = if let (Some(_duration), Some(progress)) = (duration_ms, progress_ms) {
        Some(Utc::now().timestamp_millis() - progress)
    } else {
        None
    };

    let end_timestamp = if let Some(duration) = duration_ms {
        start_timestamp.map(|start| start + duration)
    } else {
        None
    };

    let activity_request = crate::models::UpdateActivityRequest {
        activity_type: Some("listening".to_string()),
        name: Some("Spotify".to_string()),
        details: Some(track_name.clone()),
        state: Some(format!("by {}", artist_name)),
        start_timestamp,
        end_timestamp,
        large_image_url: album_image_url.clone(),
        small_image_url: Some("https://open.spotify.com/favicon.ico".to_string()),
        large_image_text: Some(album_name.clone()),
        small_image_text: Some("Spotify".to_string()),
        metadata: Some(serde_json::json!({
            "track_name": track_name,
            "artist_name": artist_name,
            "album_name": album_name,
            "duration_ms": duration_ms,
            "progress_ms": progress_ms,
        })),
    };

    let activity = state
        .db
        .upsert_user_activity(auth.user_id, &activity_request)
        .await?;

    crate::ws::broadcast_activity_update(&state, auth.user_id, Some(activity.into())).await;

    Ok(StatusCode::OK)
}
