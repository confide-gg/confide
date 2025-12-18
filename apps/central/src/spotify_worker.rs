use chrono::{Duration, Utc};
use std::sync::Arc;
use tokio::time::{sleep, Duration as TokioDuration};

use crate::models::{SpotifyIntegration, UpdateActivityRequest};
use crate::ws::broadcast_activity_update;
use crate::AppState;

const POLL_INTERVAL_SECONDS: u64 = 5;

pub async fn run_spotify_worker(state: Arc<AppState>) {
    tracing::info!("Spotify activity worker started");

    loop {
        sleep(TokioDuration::from_secs(POLL_INTERVAL_SECONDS)).await;

        match state.db.get_active_spotify_integrations().await {
            Ok(integrations) => {
                for integration in integrations {
                    let user_id = integration.user_id;
                    if let Err(e) = update_user_spotify_activity(&state, integration).await {
                        tracing::error!(
                            "Failed to update Spotify activity for user {}: {}",
                            user_id,
                            e
                        );
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch active Spotify integrations: {}", e);
            }
        }
    }
}

async fn update_user_spotify_activity(
    state: &Arc<AppState>,
    mut integration: SpotifyIntegration,
) -> anyhow::Result<()> {
    if integration.token_expires_at < Utc::now() {
        integration = refresh_spotify_token(state, &integration).await?;
    }

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.spotify.com/v1/me/player/currently-playing")
        .bearer_auth(&integration.access_token)
        .send()
        .await?;

    if response.status() == 204 {
        state.db.delete_user_activity(integration.user_id).await?;
        broadcast_activity_update(state, integration.user_id, None).await;
        return Ok(());
    }

    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Spotify API error: {}", response.status()));
    }

    let data: serde_json::Value = response.json().await?;

    let is_playing = data["is_playing"].as_bool().unwrap_or(false);

    if !is_playing {
        state.db.delete_user_activity(integration.user_id).await?;
        broadcast_activity_update(state, integration.user_id, None).await;
        return Ok(());
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
    let track_url = data["item"]["external_urls"]["spotify"]
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

    let activity_request = UpdateActivityRequest {
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
            "track_url": track_url,
            "duration_ms": duration_ms,
            "progress_ms": progress_ms,
        })),
    };

    let activity = state
        .db
        .upsert_user_activity(integration.user_id, &activity_request)
        .await?;

    broadcast_activity_update(state, integration.user_id, Some(activity.into())).await;

    Ok(())
}

async fn refresh_spotify_token(
    state: &Arc<AppState>,
    integration: &SpotifyIntegration,
) -> anyhow::Result<SpotifyIntegration> {
    let client_id = std::env::var("SPOTIFY_CLIENT_ID")?;
    let client_secret = std::env::var("SPOTIFY_CLIENT_SECRET")?;

    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", &integration.refresh_token),
    ];

    let response = client
        .post("https://accounts.spotify.com/api/token")
        .basic_auth(&client_id, Some(&client_secret))
        .form(&params)
        .send()
        .await?;

    #[derive(serde::Deserialize)]
    struct TokenResponse {
        access_token: String,
        expires_in: i64,
        refresh_token: Option<String>,
        scope: String,
    }

    let token_response: TokenResponse = response.json().await?;

    let expires_at = Utc::now() + Duration::seconds(token_response.expires_in);
    let new_refresh_token = token_response
        .refresh_token
        .as_deref()
        .unwrap_or(&integration.refresh_token);

    state
        .db
        .upsert_spotify_integration(
            integration.user_id,
            &token_response.access_token,
            new_refresh_token,
            expires_at,
            &token_response.scope,
        )
        .await?;

    state
        .db
        .get_spotify_integration(integration.user_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Failed to fetch updated integration"))
}
