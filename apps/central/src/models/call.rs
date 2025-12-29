use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallType {
    Direct,
    Group,
}

impl CallType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CallType::Direct => "direct",
            CallType::Group => "group",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "direct" => Some(CallType::Direct),
            "group" => Some(CallType::Group),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParticipantStatus {
    Invited,
    Ringing,
    Connecting,
    Active,
    Left,
    Declined,
}

impl ParticipantStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ParticipantStatus::Invited => "invited",
            ParticipantStatus::Ringing => "ringing",
            ParticipantStatus::Connecting => "connecting",
            ParticipantStatus::Active => "active",
            ParticipantStatus::Left => "left",
            ParticipantStatus::Declined => "declined",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "invited" => Some(ParticipantStatus::Invited),
            "ringing" => Some(ParticipantStatus::Ringing),
            "connecting" => Some(ParticipantStatus::Connecting),
            "active" => Some(ParticipantStatus::Active),
            "left" => Some(ParticipantStatus::Left),
            "declined" => Some(ParticipantStatus::Declined),
            _ => None,
        }
    }

    pub fn is_active(&self) -> bool {
        matches!(
            self,
            ParticipantStatus::Ringing | ParticipantStatus::Connecting | ParticipantStatus::Active
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallStatus {
    Pending,
    Ringing,
    Connecting,
    Active,
    Ended,
    Missed,
    Rejected,
    Cancelled,
}

impl CallStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CallStatus::Pending => "pending",
            CallStatus::Ringing => "ringing",
            CallStatus::Connecting => "connecting",
            CallStatus::Active => "active",
            CallStatus::Ended => "ended",
            CallStatus::Missed => "missed",
            CallStatus::Rejected => "rejected",
            CallStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(CallStatus::Pending),
            "ringing" => Some(CallStatus::Ringing),
            "connecting" => Some(CallStatus::Connecting),
            "active" => Some(CallStatus::Active),
            "ended" => Some(CallStatus::Ended),
            "missed" => Some(CallStatus::Missed),
            "rejected" => Some(CallStatus::Rejected),
            "cancelled" => Some(CallStatus::Cancelled),
            _ => None,
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            CallStatus::Ended | CallStatus::Missed | CallStatus::Rejected | CallStatus::Cancelled
        )
    }

    pub fn is_active(&self) -> bool {
        matches!(
            self,
            CallStatus::Pending | CallStatus::Ringing | CallStatus::Connecting | CallStatus::Active
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallEndReason {
    Normal,
    Timeout,
    NetworkError,
    Declined,
    Busy,
    Cancelled,
    Failed,
}

impl CallEndReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            CallEndReason::Normal => "normal",
            CallEndReason::Timeout => "timeout",
            CallEndReason::NetworkError => "network_error",
            CallEndReason::Declined => "declined",
            CallEndReason::Busy => "busy",
            CallEndReason::Cancelled => "cancelled",
            CallEndReason::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "normal" => Some(CallEndReason::Normal),
            "timeout" => Some(CallEndReason::Timeout),
            "network_error" => Some(CallEndReason::NetworkError),
            "declined" => Some(CallEndReason::Declined),
            "busy" => Some(CallEndReason::Busy),
            "cancelled" => Some(CallEndReason::Cancelled),
            "failed" => Some(CallEndReason::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct Call {
    pub id: Uuid,
    pub call_type: String,
    pub caller_id: Option<Uuid>,
    pub callee_id: Option<Uuid>,
    pub initiator_id: Option<Uuid>,
    pub conversation_id: Option<Uuid>,
    pub status: String,
    pub caller_ephemeral_public: Option<Vec<u8>>,
    pub callee_ephemeral_public: Option<Vec<u8>>,
    pub relay_token_hash: Option<Vec<u8>>,
    pub relay_token_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub ring_started_at: Option<DateTime<Utc>>,
    pub answered_at: Option<DateTime<Utc>>,
    pub connected_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub end_reason: Option<String>,
    pub duration_seconds: Option<i32>,
    pub caller_left_at: Option<DateTime<Utc>>,
    pub callee_left_at: Option<DateTime<Utc>>,
}

impl Call {
    pub fn get_status(&self) -> Option<CallStatus> {
        CallStatus::from_str(&self.status)
    }

    pub fn get_call_type(&self) -> Option<CallType> {
        CallType::from_str(&self.call_type)
    }

    pub fn is_group_call(&self) -> bool {
        self.get_call_type() == Some(CallType::Group)
    }

    pub fn get_end_reason(&self) -> Option<CallEndReason> {
        self.end_reason
            .as_ref()
            .and_then(|r| CallEndReason::from_str(r))
    }

    pub fn is_participant(&self, user_id: Uuid) -> bool {
        self.caller_id == Some(user_id) || self.callee_id == Some(user_id)
    }

    pub fn peer_id(&self, user_id: Uuid) -> Option<Uuid> {
        if self.caller_id == Some(user_id) {
            self.callee_id
        } else if self.callee_id == Some(user_id) {
            self.caller_id
        } else {
            None
        }
    }

    pub fn is_caller(&self, user_id: Uuid) -> bool {
        self.caller_id == Some(user_id)
    }

    pub fn is_initiator(&self, user_id: Uuid) -> bool {
        self.initiator_id == Some(user_id)
    }

    pub fn has_user_left(&self, user_id: Uuid) -> bool {
        if self.caller_id == Some(user_id) {
            self.caller_left_at.is_some()
        } else if self.callee_id == Some(user_id) {
            self.callee_left_at.is_some()
        } else {
            false
        }
    }

    pub fn user_left_at(&self, user_id: Uuid) -> Option<DateTime<Utc>> {
        if self.caller_id == Some(user_id) {
            self.caller_left_at
        } else if self.callee_id == Some(user_id) {
            self.callee_left_at
        } else {
            None
        }
    }

    pub fn is_rejoinable(&self, user_id: Uuid, rejoin_window_seconds: i64) -> bool {
        if !self.is_participant(user_id) {
            return false;
        }
        let status = match self.get_status() {
            Some(s) => s,
            None => return false,
        };
        if status != CallStatus::Active {
            return false;
        }
        if let Some(left_at) = self.user_left_at(user_id) {
            let now = Utc::now();
            let elapsed = now.signed_duration_since(left_at).num_seconds();
            elapsed < rejoin_window_seconds
        } else {
            false
        }
    }

    pub fn peer_has_left(&self, user_id: Uuid) -> bool {
        let peer_id = match self.peer_id(user_id) {
            Some(id) => id,
            None => return false,
        };
        self.has_user_left(peer_id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallResponse {
    pub id: Uuid,
    pub call_type: CallType,
    pub caller_id: Option<Uuid>,
    pub callee_id: Option<Uuid>,
    pub initiator_id: Option<Uuid>,
    pub conversation_id: Option<Uuid>,
    pub status: CallStatus,
    pub created_at: DateTime<Utc>,
    pub ring_started_at: Option<DateTime<Utc>>,
    pub answered_at: Option<DateTime<Utc>>,
    pub connected_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub end_reason: Option<CallEndReason>,
    pub duration_seconds: Option<i32>,
    pub caller_left_at: Option<DateTime<Utc>>,
    pub callee_left_at: Option<DateTime<Utc>>,
}

impl From<Call> for CallResponse {
    fn from(call: Call) -> Self {
        Self {
            id: call.id,
            call_type: CallType::from_str(&call.call_type).unwrap_or(CallType::Direct),
            caller_id: call.caller_id,
            callee_id: call.callee_id,
            initiator_id: call.initiator_id,
            conversation_id: call.conversation_id,
            status: CallStatus::from_str(&call.status).unwrap_or(CallStatus::Ended),
            created_at: call.created_at,
            ring_started_at: call.ring_started_at,
            answered_at: call.answered_at,
            connected_at: call.connected_at,
            ended_at: call.ended_at,
            end_reason: call
                .end_reason
                .as_ref()
                .and_then(|r| CallEndReason::from_str(r)),
            duration_seconds: call.duration_seconds,
            caller_left_at: call.caller_left_at,
            callee_left_at: call.callee_left_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallWithPeerInfo {
    pub call: CallResponse,
    pub peer_username: String,
    pub peer_display_name: Option<String>,
    pub peer_avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCallRequest {
    pub call_id: Uuid,
    pub callee_id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub ephemeral_kem_public: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerCallRequest {
    pub ephemeral_kem_public: Vec<u8>,
    pub kem_ciphertext: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyExchangeCompleteRequest {
    pub kem_ciphertext: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndCallRequest {
    pub reason: CallEndReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayCredentials {
    pub call_id: Uuid,
    pub relay_endpoint: String,
    pub relay_token: Vec<u8>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct GroupCallParticipant {
    pub call_id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub is_muted: bool,
    pub is_deafened: bool,
    pub joined_at: Option<DateTime<Utc>>,
    pub left_at: Option<DateTime<Utc>>,
    pub encrypted_sender_key: Option<Vec<u8>>,
    pub sender_key_version: Option<i32>,
}

impl GroupCallParticipant {
    pub fn get_status(&self) -> Option<ParticipantStatus> {
        ParticipantStatus::from_str(&self.status)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCallParticipantInfo {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub status: ParticipantStatus,
    pub is_muted: bool,
    pub joined_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCallResponse {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub initiator_id: Uuid,
    pub status: CallStatus,
    pub participants: Vec<GroupCallParticipantInfo>,
    pub created_at: DateTime<Utc>,
    pub ring_started_at: Option<DateTime<Utc>>,
    pub connected_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupCallRequest {
    pub call_id: Uuid,
    pub conversation_id: Uuid,
    pub announcement: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinGroupCallRequest {
    pub encrypted_sender_key_bundle: Vec<u8>,
    pub signature: Vec<u8>,
    pub joiner_ephemeral_public: Vec<u8>,
    pub identity_public: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCallMuteRequest {
    pub is_muted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveGroupCallResponse {
    pub call_id: Uuid,
    pub conversation_id: Uuid,
    pub initiator_id: Uuid,
    pub status: CallStatus,
    pub participant_count: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendSenderKeyRequest {
    pub target_user_id: Uuid,
    pub encrypted_sender_key: Vec<u8>,
    pub sender_identity_public: Vec<u8>,
    pub sender_ephemeral_public: Vec<u8>,
}
