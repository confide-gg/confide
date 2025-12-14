use futures::StreamExt;
use std::collections::VecDeque;
use std::time::Duration;
use tokio::sync::mpsc;

pub struct PubSub {
    inner: redis::aio::PubSub,
    subscribe_rx: mpsc::Receiver<String>,
}

#[derive(Clone)]
pub struct PubSubHandle {
    subscribe_tx: mpsc::Sender<String>,
}

impl PubSubHandle {
    pub async fn subscribe(&self, channel: &str) -> Result<(), mpsc::error::SendError<String>> {
        self.subscribe_tx.send(channel.to_string()).await
    }
}

impl PubSub {
    pub async fn new(client: &redis::Client) -> Result<(Self, PubSubHandle), redis::RedisError> {
        let pubsub = client.get_async_pubsub().await?;
        let (subscribe_tx, subscribe_rx) = mpsc::channel(32);
        Ok((
            Self {
                inner: pubsub,
                subscribe_rx,
            },
            PubSubHandle { subscribe_tx },
        ))
    }

    #[allow(dead_code)]
    pub async fn subscribe(&mut self, channels: &[String]) -> Result<(), redis::RedisError> {
        for channel in channels {
            self.inner.subscribe(channel).await?;
        }
        Ok(())
    }

    pub async fn run(mut self, tx: mpsc::Sender<String>) {
        let mut pending_subs: VecDeque<String> = VecDeque::new();

        loop {
            while let Ok(channel) = self.subscribe_rx.try_recv() {
                pending_subs.push_back(channel);
            }

            while let Some(channel) = pending_subs.pop_front() {
                if let Err(e) = self.inner.subscribe(&channel).await {
                    tracing::error!("Failed to subscribe to channel {}: {:?}", channel, e);
                } else {
                    tracing::debug!("Dynamically subscribed to channel: {}", channel);
                }
            }

            let mut msg_stream = self.inner.on_message();

            tokio::select! {
                biased;

                result = tokio::time::timeout(Duration::from_millis(100), msg_stream.next()) => {
                    match result {
                        Ok(Some(msg)) => {
                            let payload: String = msg.get_payload().unwrap_or_default();
                            if tx.send(payload).await.is_err() {
                                break;
                            }
                        }
                        Ok(None) => break,
                        Err(_) => {}
                    }
                }
            }
        }
    }
}
