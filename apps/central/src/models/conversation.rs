use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub conversation_type: String,
    pub encrypted_metadata: Option<Vec<u8>>,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConversationType {
    Dm,
    Group,
    Channel,
}

impl ConversationType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConversationType::Dm => "dm",
            ConversationType::Group => "group",
            ConversationType::Channel => "channel",
        }
    }
}

impl TryFrom<String> for ConversationType {
    type Error = ();

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "dm" => Ok(ConversationType::Dm),
            "group" => Ok(ConversationType::Group),
            "channel" => Ok(ConversationType::Channel),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ConversationRouting {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub encrypted_sender_key: Vec<u8>,
    pub encrypted_role: Vec<u8>,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConversationWithRouting {
    pub id: Uuid,
    pub conversation_type: String,
    pub encrypted_metadata: Option<Vec<u8>>,
    pub owner_id: Option<Uuid>,
    pub encrypted_sender_key: Vec<u8>,
    pub encrypted_role: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ConversationMemberWithUser {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub encrypted_sender_key: Vec<u8>,
    pub encrypted_role: Vec<u8>,
    pub joined_at: DateTime<Utc>,
    pub username: String,
    pub kem_public_key: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
}
