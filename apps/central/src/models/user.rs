use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub password_hash: Vec<u8>,
    pub kem_public_key: Vec<u8>,
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
    pub recovery_kem_encrypted_private: Option<Vec<u8>>,
    pub recovery_dsa_encrypted_private: Option<Vec<u8>>,
    pub recovery_key_salt: Option<Vec<u8>>,
    pub recovery_setup_completed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicUser {
    pub id: Uuid,
    pub username: String,
    pub kem_public_key: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
}

impl From<User> for PublicUser {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            kem_public_key: user.kem_public_key,
            dsa_public_key: user.dsa_public_key,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserKeys {
    pub kem_public_key: Vec<u8>,
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryKeys {
    pub recovery_kem_encrypted_private: Vec<u8>,
    pub recovery_dsa_encrypted_private: Vec<u8>,
    pub recovery_key_salt: Vec<u8>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: Vec<u8>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserFriends {
    pub user_id: Uuid,
    pub encrypted_friends: Vec<u8>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FriendRequest {
    pub id: Uuid,
    pub from_user_id: Uuid,
    pub to_user_id: Uuid,
    pub encrypted_message: Option<Vec<u8>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserServers {
    pub user_id: Uuid,
    pub encrypted_servers: Vec<u8>,
    pub updated_at: DateTime<Utc>,
}
