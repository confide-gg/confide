use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub permissions: i64,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[allow(dead_code)]
pub mod permissions {
    pub const NONE: i64 = 0;
    pub const CREATE_INVITE: i64 = 1 << 0;
    pub const KICK_MEMBERS: i64 = 1 << 1;
    pub const BAN_MEMBERS: i64 = 1 << 2;
    pub const MANAGE_CHANNELS: i64 = 1 << 3;
    pub const MANAGE_SERVER: i64 = 1 << 4;
    pub const READ_MESSAGES: i64 = 1 << 5;
    pub const SEND_MESSAGES: i64 = 1 << 6;
    pub const MANAGE_MESSAGES: i64 = 1 << 7;
    pub const MENTION_EVERYONE: i64 = 1 << 8;
    pub const ADMINISTRATOR: i64 = 1 << 9;
    pub const MANAGE_ROLES: i64 = 1 << 10;
    pub const VIEW_CHANNELS: i64 = 1 << 11;

    pub const DEFAULT_MEMBER: i64 = READ_MESSAGES | SEND_MESSAGES | VIEW_CHANNELS;

    pub fn has_permission(user_perms: i64, required: i64) -> bool {
        if user_perms & ADMINISTRATOR != 0 {
            return true;
        }
        user_perms & required != 0
    }
}
