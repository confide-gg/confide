use tokio::sync::mpsc;
use uuid::Uuid;

pub const DEFAULT_WS_CHANNEL_CAPACITY: usize = 1000;
const MAX_BACKOFF_MS: u64 = 100;
const MAX_RETRY_ATTEMPTS: usize = 3;

pub fn create_ws_channel<T>() -> (mpsc::Sender<T>, mpsc::Receiver<T>) {
    mpsc::channel::<T>(DEFAULT_WS_CHANNEL_CAPACITY)
}

pub async fn try_send_with_backoff<T: Clone>(
    sender: &mpsc::Sender<T>,
    msg: T,
    member_id: Uuid,
) -> Result<(), &'static str> {
    for attempt in 0..MAX_RETRY_ATTEMPTS {
        match sender.try_send(msg.clone()) {
            Ok(()) => return Ok(()),
            Err(mpsc::error::TrySendError::Full(_)) => {
                if attempt < MAX_RETRY_ATTEMPTS - 1 {
                    let backoff_ms = (1 << attempt).min(MAX_BACKOFF_MS);
                    tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                    tracing::debug!(
                        "WebSocket channel full for member {}, retrying after {}ms (attempt {}/{})",
                        member_id,
                        backoff_ms,
                        attempt + 1,
                        MAX_RETRY_ATTEMPTS
                    );
                } else {
                    tracing::warn!(
                        "WebSocket channel full for member {} after {} attempts, dropping message",
                        member_id,
                        MAX_RETRY_ATTEMPTS
                    );
                    return Err("channel full after retries");
                }
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                tracing::debug!("WebSocket channel closed for member {}", member_id);
                return Err("channel closed");
            }
        }
    }
    Err("max retries exceeded")
}
