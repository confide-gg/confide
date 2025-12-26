use std::collections::HashMap;
use uuid::Uuid;

use crate::error::Result;
use crate::models::{Ban, Member};

use super::Database;

impl Database {
    pub async fn create_member(
        &self,
        central_user_id: Uuid,
        username: String,
        kem_public_key: Vec<u8>,
        dsa_public_key: Vec<u8>,
    ) -> Result<Member> {
        let member = sqlx::query_as::<_, Member>(
            r#"
            INSERT INTO members (central_user_id, username, kem_public_key, dsa_public_key)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(central_user_id)
        .bind(username)
        .bind(kem_public_key)
        .bind(dsa_public_key)
        .fetch_one(&self.pool)
        .await?;
        Ok(member)
    }

    pub async fn get_member(&self, member_id: Uuid) -> Result<Option<Member>> {
        let member = sqlx::query_as::<_, Member>("SELECT * FROM members WHERE id = $1")
            .bind(member_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(member)
    }

    pub async fn get_member_by_central_id(&self, central_user_id: Uuid) -> Result<Option<Member>> {
        let member =
            sqlx::query_as::<_, Member>("SELECT * FROM members WHERE central_user_id = $1")
                .bind(central_user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(member)
    }

    pub async fn get_all_members(&self) -> Result<Vec<Member>> {
        let members = sqlx::query_as::<_, Member>("SELECT * FROM members ORDER BY joined_at ASC")
            .fetch_all(&self.pool)
            .await?;
        Ok(members)
    }

    pub async fn get_member_count(&self) -> Result<i32> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM members")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0 as i32)
    }

    pub async fn update_member(
        &self,
        member_id: Uuid,
        display_name: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<()> {
        sqlx::query("UPDATE members SET display_name = COALESCE($2, display_name), avatar_url = COALESCE($3, avatar_url) WHERE id = $1")
            .bind(member_id)
            .bind(display_name)
            .bind(avatar_url)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_member(&self, member_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM members WHERE id = $1")
            .bind(member_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn assign_role(&self, member_id: Uuid, role_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO member_roles (member_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (member_id, role_id) DO NOTHING
            "#,
        )
        .bind(member_id)
        .bind(role_id)
        .execute(&self.pool)
        .await?;

        let cache_key = format!("permissions:{}", member_id);
        let mut conn = self.redis_conn().await?;
        let _: () = redis::cmd("DEL")
            .arg(&cache_key)
            .query_async(&mut conn)
            .await?;

        Ok(())
    }

    pub async fn remove_role(&self, member_id: Uuid, role_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM member_roles WHERE member_id = $1 AND role_id = $2")
            .bind(member_id)
            .bind(role_id)
            .execute(&self.pool)
            .await?;

        let cache_key = format!("permissions:{}", member_id);
        let mut conn = self.redis_conn().await?;
        let _: () = redis::cmd("DEL")
            .arg(&cache_key)
            .query_async(&mut conn)
            .await?;

        Ok(())
    }

    pub async fn get_member_role_ids(&self, member_id: Uuid) -> Result<Vec<Uuid>> {
        let roles: Vec<(Uuid,)> =
            sqlx::query_as("SELECT role_id FROM member_roles WHERE member_id = $1")
                .bind(member_id)
                .fetch_all(&self.pool)
                .await?;
        Ok(roles.into_iter().map(|r| r.0).collect())
    }

    pub async fn get_all_member_roles(&self) -> Result<std::collections::HashMap<Uuid, Vec<Uuid>>> {
        let rows: Vec<(Uuid, Uuid)> =
            sqlx::query_as("SELECT member_id, role_id FROM member_roles ORDER BY member_id")
                .fetch_all(&self.pool)
                .await?;

        let mut map: std::collections::HashMap<Uuid, Vec<Uuid>> = std::collections::HashMap::new();
        for (member_id, role_id) in rows {
            map.entry(member_id).or_default().push(role_id);
        }
        Ok(map)
    }

    pub async fn ban_user(
        &self,
        central_user_id: Uuid,
        banned_by: Uuid,
        reason: Option<String>,
    ) -> Result<Ban> {
        let ban = sqlx::query_as::<_, Ban>(
            r#"
            INSERT INTO bans (central_user_id, banned_by, reason)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(central_user_id)
        .bind(banned_by)
        .bind(reason)
        .fetch_one(&self.pool)
        .await?;
        Ok(ban)
    }

    pub async fn unban_user(&self, central_user_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM bans WHERE central_user_id = $1")
            .bind(central_user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn is_banned(&self, central_user_id: Uuid) -> Result<bool> {
        let exists: (bool,) =
            sqlx::query_as("SELECT EXISTS(SELECT 1 FROM bans WHERE central_user_id = $1)")
                .bind(central_user_id)
                .fetch_one(&self.pool)
                .await?;
        Ok(exists.0)
    }

    pub async fn get_all_bans(&self) -> Result<Vec<Ban>> {
        let bans = sqlx::query_as::<_, Ban>("SELECT * FROM bans ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;
        Ok(bans)
    }

    pub async fn get_all_members_with_roles(&self) -> Result<Vec<(Member, Vec<Uuid>)>> {
        let members = self.get_all_members().await?;
        if members.is_empty() {
            return Ok(vec![]);
        }

        let member_ids: Vec<Uuid> = members.iter().map(|m| m.id).collect();

        let role_mappings: Vec<(Uuid, Uuid)> =
            sqlx::query_as("SELECT member_id, role_id FROM member_roles WHERE member_id = ANY($1)")
                .bind(&member_ids)
                .fetch_all(&self.pool)
                .await?;

        let mut roles_by_member: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
        for (member_id, role_id) in role_mappings {
            roles_by_member.entry(member_id).or_default().push(role_id);
        }

        Ok(members
            .into_iter()
            .map(|member| {
                let roles = roles_by_member.get(&member.id).cloned().unwrap_or_default();
                (member, roles)
            })
            .collect())
    }
}
