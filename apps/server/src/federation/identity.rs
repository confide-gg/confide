use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug, Serialize)]
struct VerifyTokenRequest {
    server_id: Uuid,
    token_hash: Vec<u8>,
    user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct FederationUserInfo {
    pub user_id: Uuid,
    pub username: String,
    pub kem_public_key: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct VerifyTokenResponse {
    valid: bool,
    user_info: Option<FederationUserInfo>,
}

pub async fn verify_federation_token(
    client: &Client,
    server_id: Uuid,
    token: &str,
    user_id: Uuid,
    central_url: &str,
) -> Result<Option<FederationUserInfo>, String> {
    let token_bytes = hex::decode(token).map_err(|e| format!("Invalid token format: {}", e))?;
    let token_hash = Sha256::digest(&token_bytes).to_vec();

    let request = VerifyTokenRequest {
        server_id,
        token_hash,
        user_id,
    };

    let response = client
        .post(format!("{}/federation/verify-token", central_url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to contact Central: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Central returned error: {}", response.status()));
    }

    let result: VerifyTokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if result.valid {
        Ok(result.user_info)
    } else {
        Ok(None)
    }
}
