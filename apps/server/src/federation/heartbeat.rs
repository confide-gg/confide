use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use uuid::Uuid;

use crate::db::Database;

#[derive(Debug, Serialize)]
struct HeartbeatRequest {
    server_id: Uuid,
    member_count: i32,
    timestamp: i64,
    signature: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct HeartbeatResponse {
    #[allow(dead_code)]
    acknowledged: bool,
}

pub struct HeartbeatService {
    client: Client,
    db: Database,
    central_url: String,
}

impl HeartbeatService {
    pub fn new(db: Database, central_url: String) -> Self {
        Self {
            client: Client::new(),
            db,
            central_url,
        }
    }

    pub fn start(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(5 * 60));
            loop {
                interval.tick().await;
                if let Err(e) = self.send_heartbeat().await {
                    tracing::error!("Heartbeat failed: {}", e);
                }
            }
        });
    }

    async fn send_heartbeat(&self) -> Result<(), String> {
        let identity = self
            .db
            .get_server_identity()
            .await
            .map_err(|e| format!("DB error: {}", e))?
            .ok_or("Server not setup")?;

        let server_id = identity
            .central_registration_id
            .ok_or("Server not registered with Central")?;

        let member_count = self
            .db
            .get_member_count()
            .await
            .map_err(|e| format!("DB error: {}", e))?;

        let timestamp = Utc::now().timestamp();

        let signature_data = format!("{}:{}:{}", server_id, member_count, timestamp);
        let signature = Sha256::digest(signature_data.as_bytes()).to_vec();

        let request = HeartbeatRequest {
            server_id,
            member_count,
            timestamp,
            signature,
        };

        let response = self
            .client
            .post(format!("{}/federation/heartbeat", self.central_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if response.status().is_success() {
            let _: HeartbeatResponse = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            tracing::debug!("Heartbeat sent successfully");
            Ok(())
        } else {
            Err(format!("Central returned: {}", response.status()))
        }
    }
}
