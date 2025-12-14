use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::messages::MessageWithKey;
use crate::models::{Category, Member, Role, TextChannel};

/// Messages sent from client to server
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    SubscribeChannel { channel_id: Uuid },
    UnsubscribeChannel { channel_id: Uuid },
    Typing { channel_id: Uuid },
    StopTyping { channel_id: Uuid },
    SubscribeUser { user_id: Uuid },
    UpdatePresence { status: String },
    Ping,
}

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // Connection
    Connected {
        member_id: Uuid,
    },
    Pong,

    // Messages
    NewMessage {
        message: MessageWithKey,
    },
    MessageDeleted {
        channel_id: Uuid,
        message_id: Uuid,
    },

    // Typing indicators
    TypingStart {
        channel_id: Uuid,
        member_id: Uuid,
        username: String,
    },
    TypingStop {
        channel_id: Uuid,
        member_id: Uuid,
    },

    // Members
    MemberJoined {
        member: Member,
    },
    MemberLeft {
        member_id: Uuid,
    },
    MemberUpdated {
        member: Member,
    },
    MemberBanned {
        member_id: Uuid,
    },

    // Channels
    ChannelCreated {
        channel: TextChannel,
    },
    ChannelUpdated {
        channel: TextChannel,
    },
    ChannelDeleted {
        channel_id: Uuid,
    },

    // Categories
    CategoryCreated {
        category: Category,
    },
    CategoryUpdated {
        category: Category,
    },
    CategoryDeleted {
        category_id: Uuid,
    },

    // Roles
    RoleCreated {
        role: Role,
    },
    RoleUpdated {
        role: Role,
    },
    RoleDeleted {
        role_id: Uuid,
    },
    MemberRolesUpdated {
        member_id: Uuid,
        role_ids: Vec<Uuid>,
    },

    // Server
    ServerUpdated {
        name: String,
        description: Option<String>,
        icon_url: Option<String>,
    },

    // Presence
    PresenceUpdate {
        member_id: Uuid,
        status: String,
        online: bool,
    },
    PresenceSync {
        presences: Vec<MemberPresence>,
    },

    // Errors
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct MemberPresence {
    pub member_id: Uuid,
    pub status: String,
}
