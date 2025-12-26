use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TextChannel {
    pub id: Uuid,
    pub category_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MemberChannelKey {
    pub member_id: Uuid,
    pub channel_id: Uuid,
    pub encrypted_key: Vec<u8>,
    pub key_version: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct ChannelPermissionOverride {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub role_id: Option<Uuid>,
    pub member_id: Option<Uuid>,
    pub allow_permissions: i64,
    pub deny_permissions: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Invite {
    pub id: Uuid,
    pub code: String,
    pub created_by: Uuid,
    pub max_uses: Option<i32>,
    pub uses: i32,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
