use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Member {
    pub id: Uuid,
    pub central_user_id: Uuid,
    pub username: String,
    pub kem_public_key: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub joined_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MemberRoleAssignment {
    pub member_id: Uuid,
    pub role_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Ban {
    pub central_user_id: Uuid,
    pub banned_by: Uuid,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}
