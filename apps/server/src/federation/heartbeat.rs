use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use uuid::Uuid;

use crate::config::Config;
use crate::db::Database;

#[derive(Debug, Serialize)]
struct HeartbeatRequest {
    server_id: Uuid,
    member_count: i32,
    timestamp: i64,
    nonce: Uuid,
    signature: Vec<u8>,
    display_name: String,
    description: Option<String>,
    is_discoverable: bool,
    icon_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HeartbeatResponse {
    #[allow(dead_code)]
    acknowledged: bool,
}

pub struct HeartbeatService {
    client: Client,
    db: Database,
    config: Arc<Config>,
}

impl HeartbeatService {
    pub fn new(db: Database, config: Arc<Config>) -> Self {
        Self {
            client: Client::new(),
            db,
            config,
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
        let nonce = Uuid::new_v4();

        let message_data = format!("{}:{}:{}:{}", server_id, member_count, timestamp, nonce);

        use confide_sdk::crypto::keys::DsaKeyPair;
        use confide_sdk::decrypt_aes_gcm;

        let encryption_key = self.config.security.dsa_encryption_key;

        let private_bytes = decrypt_aes_gcm(&encryption_key, &identity.dsa_private_key_encrypted)
            .map_err(|e| format!("Failed to decrypt private key: {}", e))?;

        let keypair = DsaKeyPair::from_bytes(&identity.dsa_public_key, &private_bytes)
            .map_err(|e| format!("Invalid keypair: {}", e))?;

        let signature = keypair
            .sign(message_data.as_bytes())
            .map_err(|e| format!("Failed to sign: {}", e))?;

        let request = HeartbeatRequest {
            server_id,
            member_count,
            timestamp,
            nonce,
            signature,
            display_name: identity.server_name,
            description: identity.description,
            is_discoverable: identity.is_discoverable,
            icon_url: identity.icon_url,
        };

        let response = self
            .client
            .post(format!(
                "{}/federation/heartbeat",
                self.config.server.central_url
            ))
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
