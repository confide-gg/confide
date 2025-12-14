use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Default)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum MessageType {
    #[default]
    Text,
    CallEnded,
    CallMissed,
    CallRejected,
}

impl std::fmt::Display for MessageType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageType::Text => write!(f, "text"),
            MessageType::CallEnded => write!(f, "call_ended"),
            MessageType::CallMissed => write!(f, "call_missed"),
            MessageType::CallRejected => write!(f, "call_rejected"),
        }
    }
}

impl std::str::FromStr for MessageType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "text" => Ok(MessageType::Text),
            "call_ended" => Ok(MessageType::CallEnded),
            "call_missed" => Ok(MessageType::CallMissed),
            "call_rejected" => Ok(MessageType::CallRejected),
            _ => Err(format!("Unknown message type: {}", s)),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MessageRow {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
    pub expires_at: Option<DateTime<Utc>>,
    pub sender_chain_id: Option<i32>,
    pub sender_chain_iteration: Option<i32>,
    pub edited_at: Option<DateTime<Utc>>,
    pub message_type: String,
    pub call_id: Option<Uuid>,
    pub call_duration_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub encrypted_content: Vec<u8>,
    pub signature: Vec<u8>,
    pub reply_to_id: Option<Uuid>,
    pub expires_at: Option<DateTime<Utc>>,
    pub sender_chain_id: Option<i32>,
    pub sender_chain_iteration: Option<i32>,
    pub edited_at: Option<DateTime<Utc>>,
    pub message_type: String,
    pub call_id: Option<Uuid>,
    pub call_duration_seconds: Option<i32>,
    pub reactions: Vec<MessageReaction>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MessageReaction {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MessageKey {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub encrypted_key: Vec<u8>,
    pub created_at: DateTime<Utc>,
}
