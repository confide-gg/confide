use serde_json::json;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use uuid::Uuid;

use crate::AppState;

const CALL_CLEANUP_INTERVAL_SECS: u64 = 30;
const CALL_REJOIN_WINDOW_SECS: i64 = 300;

pub async fn run_cleanup_task(state: Arc<AppState>) {
    let interval_hours = state.config.messages.cleanup_interval_hours;
    let mut interval = interval(Duration::from_secs(interval_hours * 3600));

    loop {
        interval.tick().await;

        let ttl_days = state.config.messages.ttl_days;
        match state.db.delete_old_messages(ttl_days).await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("cleaned up {} old messages", count);
                }
            }
            Err(e) => {
                tracing::error!("failed to clean up old messages: {:?}", e);
            }
        }

        match state.db.delete_expired_messages().await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("cleaned up {} expired messages", count);
                }
            }
            Err(e) => {
                tracing::error!("failed to clean up expired messages: {:?}", e);
            }
        }

        match state.db.delete_expired_sessions().await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("cleaned up {} expired sessions", count);
                }
            }
            Err(e) => {
                tracing::error!("failed to clean up expired sessions: {:?}", e);
            }
        }

        let retention_days = state.config.uploads.retention_days;
        match state.db.delete_orphaned_uploads(retention_days).await {
            Ok(s3_keys) => {
                if !s3_keys.is_empty() {
                    tracing::info!("cleaned up {} orphaned uploads", s3_keys.len());
                    for s3_key in s3_keys {
                        if let Err(e) = state.s3.delete_file(&s3_key).await {
                            tracing::error!(
                                "failed to delete orphaned upload from S3 {}: {:?}",
                                s3_key,
                                e
                            );
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("failed to clean up uploads: {:?}", e);
            }
        }
    }
}

pub async fn run_call_cleanup_task(state: Arc<AppState>) {
    let mut interval = interval(Duration::from_secs(CALL_CLEANUP_INTERVAL_SECS));

    loop {
        interval.tick().await;

        match state.db.timeout_stale_calls().await {
            Ok(calls) => {
                for call in &calls {
                    tracing::info!("timed out stale ringing call: {}", call.id);
                    if let (Some(caller_id), Some(callee_id)) = (call.caller_id, call.callee_id) {
                        notify_call_missed(&state, call.id, caller_id, callee_id).await;
                    }
                }
            }
            Err(e) => {
                tracing::error!("failed to timeout stale calls: {:?}", e);
            }
        }

        match state.db.end_calls_with_both_left(0).await {
            Ok(calls) => {
                for call in &calls {
                    tracing::info!("ended call with both participants left: {}", call.id);
                    if let (Some(caller_id), Some(callee_id)) = (call.caller_id, call.callee_id) {
                        notify_call_ended(
                            &state,
                            call.id,
                            caller_id,
                            callee_id,
                            "both_left",
                            call.duration_seconds,
                        )
                        .await;
                    }
                }
            }
            Err(e) => {
                tracing::error!("failed to end calls with both left: {:?}", e);
            }
        }

        match state.db.end_abandoned_calls(CALL_REJOIN_WINDOW_SECS).await {
            Ok(calls) => {
                for call in &calls {
                    tracing::info!("ended abandoned call: {}", call.id);
                    if let (Some(caller_id), Some(callee_id)) = (call.caller_id, call.callee_id) {
                        notify_call_ended(
                            &state,
                            call.id,
                            caller_id,
                            callee_id,
                            "abandoned",
                            call.duration_seconds,
                        )
                        .await;
                    }
                }
            }
            Err(e) => {
                tracing::error!("failed to end abandoned calls: {:?}", e);
            }
        }

        match state.db.cleanup_expired_calls().await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("cleaned up {} expired long-running calls", count);
                }
            }
            Err(e) => {
                tracing::error!("failed to cleanup expired calls: {:?}", e);
            }
        }

        match state.db.cleanup_stale_connecting_calls().await {
            Ok(calls) => {
                for call in &calls {
                    tracing::info!("cleaned up stale connecting call: {}", call.id);
                    if let (Some(caller_id), Some(callee_id)) = (call.caller_id, call.callee_id) {
                        notify_call_ended(
                            &state,
                            call.id,
                            caller_id,
                            callee_id,
                            "connection_timeout",
                            call.duration_seconds,
                        )
                        .await;
                    }
                }
            }
            Err(e) => {
                tracing::error!("failed to cleanup stale connecting calls: {:?}", e);
            }
        }

        match state.db.cleanup_orphaned_calls().await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("cleaned up {} orphaned call records", count);
                }
            }
            Err(e) => {
                tracing::error!("failed to cleanup orphaned calls: {:?}", e);
            }
        }

        match state.db.cleanup_inconsistent_calls().await {
            Ok(count) => {
                if count > 0 {
                    tracing::info!("fixed {} calls with inconsistent states", count);
                }
            }
            Err(e) => {
                tracing::error!("failed to cleanup inconsistent calls: {:?}", e);
            }
        }
    }
}

async fn notify_call_missed(state: &AppState, call_id: Uuid, caller_id: Uuid, callee_id: Uuid) {
    let msg = json!({
        "type": "call_missed",
        "data": {
            "call_id": call_id,
            "caller_id": caller_id,
            "callee_id": callee_id,
        }
    });

    let json_str = msg.to_string();
    state
        .subscriptions
        .send_to_users(&[caller_id, callee_id], &json_str)
        .await;
}

async fn notify_call_ended(
    state: &AppState,
    call_id: Uuid,
    caller_id: Uuid,
    callee_id: Uuid,
    reason: &str,
    duration_seconds: Option<i32>,
) {
    let msg = json!({
        "type": "call_end",
        "data": {
            "call_id": call_id,
            "reason": reason,
            "duration_seconds": duration_seconds,
        }
    });

    let json_str = msg.to_string();
    state
        .subscriptions
        .send_to_users(&[caller_id, callee_id], &json_str)
        .await;
}
