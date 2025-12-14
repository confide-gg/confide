use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::db::Database;
use crate::error::Result;
use crate::models::{Call, CallStatus};

/// Call state information for recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallStateInfo {
    pub call_id: Uuid,
    pub status: CallStatus,
    pub is_caller: bool,
    pub peer_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub relay_endpoint: Option<String>,
    pub relay_token: Option<Vec<u8>>,
    pub relay_token_expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Call state manager with recovery capabilities
pub struct CallStateManager {
    db: Arc<Database>,
    active_calls: Arc<Mutex<std::collections::HashMap<Uuid, CallStateInfo>>>,
}

impl CallStateManager {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            active_calls: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Get active call state for a user (with recovery)
    #[allow(dead_code)]
    pub async fn get_active_call_state(&self, user_id: Uuid) -> Result<Option<CallStateInfo>> {
        let cache = self.active_calls.lock().await;
        if let Some(state) = cache.values().find(|s| s.peer_id == user_id) {
            return Ok(Some(state.clone()));
        }
        drop(cache);

        if let Some(call) = self.db.get_active_call_for_user(user_id).await? {
            let state = self.call_to_state_info(call, user_id).await?;
            self.cache_call_state(state.clone()).await;
            return Ok(Some(state));
        }

        if let Some(call) = self.db.get_rejoinable_call(user_id, 300).await? {
            let state = self.call_to_state_info(call, user_id).await?;
            self.cache_call_state(state.clone()).await;
            return Ok(Some(state));
        }

        Ok(None)
    }

    /// Cache call state information
    pub async fn cache_call_state(&self, state: CallStateInfo) {
        let mut cache = self.active_calls.lock().await;
        cache.insert(state.call_id, state);
    }

    /// Remove call state from cache
    #[allow(dead_code)]
    pub async fn remove_call_state(&self, call_id: Uuid) {
        let mut cache = self.active_calls.lock().await;
        cache.remove(&call_id);
    }

    /// Convert call to state info
    async fn call_to_state_info(&self, call: Call, user_id: Uuid) -> Result<CallStateInfo> {
        let is_caller = call.caller_id == user_id;
        let peer_id = if is_caller {
            call.callee_id
        } else {
            call.caller_id
        };
        let status = call
            .get_status()
            .ok_or_else(|| crate::error::AppError::BadRequest("Invalid call status".into()))?;

        let (relay_endpoint, relay_token_expires_at) = if call.relay_token_hash.is_some() {
            (None, call.relay_token_expires_at)
        } else {
            (None, None)
        };

        Ok(CallStateInfo {
            call_id: call.id,
            status,
            is_caller,
            peer_id,
            created_at: call.created_at,
            last_activity: Utc::now(),
            relay_endpoint,
            relay_token: None,
            relay_token_expires_at,
        })
    }

    /// Check if call is recoverable
    pub fn is_call_recoverable(&self, call: &Call, user_id: Uuid) -> bool {
        if let Some(CallStatus::Ringing | CallStatus::Connecting | CallStatus::Active) =
            call.get_status()
        {
            let created_recently = call.created_at > (Utc::now() - Duration::hours(24));
            let is_participant = call.caller_id == user_id || call.callee_id == user_id;
            let not_ended = call.ended_at.is_none();

            created_recently && is_participant && not_ended
        } else {
            false
        }
    }

    /// Recover call state after WebSocket reconnection
    pub async fn recover_call_state(&self, user_id: Uuid) -> Result<Option<CallStateInfo>> {
        if let Some(call) = self.db.get_active_call_for_user(user_id).await? {
            if self.is_call_recoverable(&call, user_id) {
                let state = self.call_to_state_info(call, user_id).await?;
                self.cache_call_state(state.clone()).await;
                return Ok(Some(state));
            }
        }

        Ok(None)
    }

    /// Clean up stale call states
    #[allow(dead_code)]
    pub async fn cleanup_stale_states(&self) -> Result<usize> {
        let mut cache = self.active_calls.lock().await;
        let now = Utc::now();
        let mut cleaned = 0;

        cache.retain(|_, state| {
            let should_retain = state.last_activity > (now - Duration::hours(1));
            if !should_retain {
                cleaned += 1;
            }
            should_retain
        });

        Ok(cleaned)
    }

    /// Get call state with timeout handling
    #[allow(dead_code)]
    pub async fn get_call_state_with_timeout(
        &self,
        _call_id: Uuid,
        user_id: Uuid,
        timeout: Duration,
    ) -> Result<Option<CallStateInfo>> {
        let start_time = Utc::now();

        loop {
            if let Some(state) = self.get_active_call_state(user_id).await? {
                return Ok(Some(state));
            }

            if Utc::now() - start_time > timeout {
                return Ok(None);
            }

            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
    }
}

/// WebSocket reconnection handler with call state recovery
pub async fn handle_websocket_reconnection(
    state: &Arc<crate::AppState>,
    user_id: Uuid,
) -> Result<Option<CallStateInfo>> {
    let call_state_manager = CallStateManager::new(Arc::new(state.db.clone()));

    if let Some(recovered_state) = call_state_manager.recover_call_state(user_id).await? {
        tracing::info!(
            "Recovered call state for user {}: call {}",
            user_id,
            recovered_state.call_id
        );

        if recovered_state.status == CallStatus::Ringing {
            if let Ok(Some(_call)) = state.db.get_call(recovered_state.call_id).await {
                tracing::info!(
                    "Resending call offer for recovered call {}",
                    recovered_state.call_id
                );
            }
        }

        return Ok(Some(recovered_state));
    }

    Ok(None)
}

/// Call state monitoring and health check
#[allow(dead_code)]
pub async fn monitor_call_health(
    state: &Arc<crate::AppState>,
    call_id: Uuid,
    _user_id: Uuid,
) -> Result<bool> {
    if let Some(call) = state.db.get_call(call_id).await? {
        if let Some(status) = call.get_status() {
            match status {
                CallStatus::Active => {
                    let caller_connected = call.caller_left_at.is_none();
                    let callee_connected = call.callee_left_at.is_none();

                    if !caller_connected || !callee_connected {
                        return Ok(false);
                    }

                    if let Some(connected_at) = call.connected_at {
                        let duration = Utc::now() - connected_at;
                        if duration > Duration::hours(2) {
                            return Ok(false);
                        }
                    }

                    return Ok(true);
                }
                CallStatus::Ringing => {
                    if let Some(ring_started_at) = call.ring_started_at {
                        let ring_duration = Utc::now() - ring_started_at;
                        if ring_duration > Duration::seconds(60) {
                            return Ok(false);
                        }
                    }
                    return Ok(true);
                }
                CallStatus::Connecting => {
                    if let Some(answered_at) = call.answered_at {
                        let connect_duration = Utc::now() - answered_at;
                        if connect_duration > Duration::seconds(30) {
                            return Ok(false);
                        }
                    }
                    return Ok(true);
                }
                _ => {
                    return Ok(false);
                }
            }
        }
    }

    Ok(false)
}
