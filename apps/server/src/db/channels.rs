use uuid::Uuid;

use crate::error::Result;
use crate::models::{Category, ChannelPermissionOverride, Invite, MemberChannelKey, TextChannel};

use super::Database;

impl Database {
    pub async fn create_category(&self, name: String, position: i32) -> Result<Category> {
        let category = sqlx::query_as::<_, Category>(
            r#"
            INSERT INTO categories (name, position)
            VALUES ($1, $2)
            RETURNING *
            "#,
        )
        .bind(name)
        .bind(position)
        .fetch_one(&self.pool)
        .await?;
        Ok(category)
    }

    pub async fn get_category(&self, category_id: Uuid) -> Result<Option<Category>> {
        let category = sqlx::query_as::<_, Category>("SELECT * FROM categories WHERE id = $1")
            .bind(category_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(category)
    }

    pub async fn get_all_categories(&self) -> Result<Vec<Category>> {
        let categories =
            sqlx::query_as::<_, Category>("SELECT * FROM categories ORDER BY position ASC")
                .fetch_all(&self.pool)
                .await?;
        Ok(categories)
    }

    pub async fn update_category(
        &self,
        category_id: Uuid,
        name: Option<String>,
        position: Option<i32>,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE categories SET name = COALESCE($2, name), position = COALESCE($3, position) WHERE id = $1",
        )
        .bind(category_id)
        .bind(name)
        .bind(position)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_category(&self, category_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM categories WHERE id = $1")
            .bind(category_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn create_channel(
        &self,
        category_id: Option<Uuid>,
        name: String,
        description: Option<String>,
        position: i32,
    ) -> Result<TextChannel> {
        let channel = sqlx::query_as::<_, TextChannel>(
            r#"
            INSERT INTO text_channels (category_id, name, description, position)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(category_id)
        .bind(name)
        .bind(description)
        .bind(position)
        .fetch_one(&self.pool)
        .await?;
        Ok(channel)
    }

    pub async fn get_channel(&self, channel_id: Uuid) -> Result<Option<TextChannel>> {
        let channel = sqlx::query_as::<_, TextChannel>("SELECT * FROM text_channels WHERE id = $1")
            .bind(channel_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(channel)
    }

    pub async fn get_all_channels(&self) -> Result<Vec<TextChannel>> {
        let channels =
            sqlx::query_as::<_, TextChannel>("SELECT * FROM text_channels ORDER BY position ASC")
                .fetch_all(&self.pool)
                .await?;
        Ok(channels)
    }

    pub async fn get_category_channels(&self, category_id: Uuid) -> Result<Vec<TextChannel>> {
        let channels = sqlx::query_as::<_, TextChannel>(
            "SELECT * FROM text_channels WHERE category_id = $1 ORDER BY position ASC",
        )
        .bind(category_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(channels)
    }

    pub async fn update_channel(
        &self,
        channel_id: Uuid,
        name: Option<String>,
        description: Option<String>,
        category_id: Option<Option<Uuid>>,
        position: Option<i32>,
    ) -> Result<()> {
        let mut query = String::from("UPDATE text_channels SET ");
        let mut params: Vec<String> = vec![];
        let mut param_count = 1;

        if name.is_some() {
            params.push(format!("name = ${}", param_count));
            param_count += 1;
        }
        if description.is_some() {
            params.push(format!("description = ${}", param_count));
            param_count += 1;
        }
        if category_id.is_some() {
            params.push(format!("category_id = ${}", param_count));
            param_count += 1;
        }
        if position.is_some() {
            params.push(format!("position = ${}", param_count));
            param_count += 1;
        }

        if params.is_empty() {
            return Ok(());
        }

        query.push_str(&params.join(", "));
        query.push_str(&format!(" WHERE id = ${}", param_count));

        let mut q = sqlx::query(&query);

        if let Some(n) = name {
            q = q.bind(n);
        }
        if let Some(d) = description {
            q = q.bind(d);
        }
        if let Some(c) = category_id {
            q = q.bind(c);
        }
        if let Some(p) = position {
            q = q.bind(p);
        }

        q = q.bind(channel_id);
        q.execute(&self.pool).await?;

        Ok(())
    }

    pub async fn delete_channel(&self, channel_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM text_channels WHERE id = $1")
            .bind(channel_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn create_invite(
        &self,
        code: String,
        created_by: Uuid,
        max_uses: Option<i32>,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Invite> {
        let invite = sqlx::query_as::<_, Invite>(
            r#"
            INSERT INTO invites (code, created_by, max_uses, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(code)
        .bind(created_by)
        .bind(max_uses)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;
        Ok(invite)
    }

    pub async fn get_invite_by_code(&self, code: &str) -> Result<Option<Invite>> {
        let invite = sqlx::query_as::<_, Invite>("SELECT * FROM invites WHERE code = $1")
            .bind(code)
            .fetch_optional(&self.pool)
            .await?;
        Ok(invite)
    }

    pub async fn try_use_invite(&self, invite_id: Uuid) -> Result<bool> {
        let result = sqlx::query(
            r#"
            UPDATE invites
            SET uses = uses + 1
            WHERE id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (max_uses IS NULL OR uses < max_uses)
            "#,
        )
        .bind(invite_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn get_all_invites(&self) -> Result<Vec<Invite>> {
        let invites = sqlx::query_as::<_, Invite>("SELECT * FROM invites ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;
        Ok(invites)
    }

    pub async fn delete_invite(&self, invite_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM invites WHERE id = $1")
            .bind(invite_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_member_channel_key(
        &self,
        member_id: Uuid,
        channel_id: Uuid,
        encrypted_key: Vec<u8>,
        key_version: i32,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO member_channel_keys (member_id, channel_id, encrypted_key, key_version)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (member_id, channel_id)
            DO UPDATE SET encrypted_key = $3, key_version = $4
            "#,
        )
        .bind(member_id)
        .bind(channel_id)
        .bind(encrypted_key)
        .bind(key_version)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn bulk_set_channel_keys(
        &self,
        channel_id: Uuid,
        distributions: Vec<(Uuid, Vec<u8>)>,
        key_version: i32,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        for (member_id, encrypted_key) in distributions {
            sqlx::query(
                r#"
                INSERT INTO member_channel_keys (member_id, channel_id, encrypted_key, key_version)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (member_id, channel_id)
                DO UPDATE SET encrypted_key = $3, key_version = $4
                "#,
            )
            .bind(member_id)
            .bind(channel_id)
            .bind(&encrypted_key)
            .bind(key_version)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn get_member_channel_keys(&self, member_id: Uuid) -> Result<Vec<MemberChannelKey>> {
        let keys = sqlx::query_as::<_, MemberChannelKey>(
            "SELECT * FROM member_channel_keys WHERE member_id = $1",
        )
        .bind(member_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(keys)
    }

    pub async fn get_channel_key(
        &self,
        member_id: Uuid,
        channel_id: Uuid,
    ) -> Result<Option<MemberChannelKey>> {
        let key = sqlx::query_as::<_, MemberChannelKey>(
            "SELECT * FROM member_channel_keys WHERE member_id = $1 AND channel_id = $2",
        )
        .bind(member_id)
        .bind(channel_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(key)
    }

    pub async fn delete_member_channel_keys(&self, member_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM member_channel_keys WHERE member_id = $1")
            .bind(member_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_channel_keys(&self, channel_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM member_channel_keys WHERE channel_id = $1")
            .bind(channel_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_channel_permission_override(
        &self,
        channel_id: Uuid,
        role_id: Option<Uuid>,
        member_id: Option<Uuid>,
        allow_permissions: i64,
        deny_permissions: i64,
    ) -> Result<ChannelPermissionOverride> {
        let query = if role_id.is_some() {
            r#"
            INSERT INTO channel_permission_overrides (channel_id, role_id, member_id, allow_permissions, deny_permissions)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (channel_id, role_id) WHERE role_id IS NOT NULL
            DO UPDATE SET allow_permissions = EXCLUDED.allow_permissions, deny_permissions = EXCLUDED.deny_permissions
            RETURNING *
            "#
        } else {
            r#"
            INSERT INTO channel_permission_overrides (channel_id, role_id, member_id, allow_permissions, deny_permissions)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (channel_id, member_id) WHERE member_id IS NOT NULL
            DO UPDATE SET allow_permissions = EXCLUDED.allow_permissions, deny_permissions = EXCLUDED.deny_permissions
            RETURNING *
            "#
        };

        let override_record = sqlx::query_as::<_, ChannelPermissionOverride>(query)
            .bind(channel_id)
            .bind(role_id)
            .bind(member_id)
            .bind(allow_permissions)
            .bind(deny_permissions)
            .fetch_one(&self.pool)
            .await?;
        Ok(override_record)
    }

    pub async fn get_channel_permission_overrides(
        &self,
        channel_id: Uuid,
    ) -> Result<Vec<ChannelPermissionOverride>> {
        let overrides = sqlx::query_as::<_, ChannelPermissionOverride>(
            "SELECT * FROM channel_permission_overrides WHERE channel_id = $1",
        )
        .bind(channel_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(overrides)
    }

    pub async fn delete_channel_permission_override(
        &self,
        channel_id: Uuid,
        role_id: Option<Uuid>,
        member_id: Option<Uuid>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            DELETE FROM channel_permission_overrides
            WHERE channel_id = $1
            AND (role_id IS NOT DISTINCT FROM $2)
            AND (member_id IS NOT DISTINCT FROM $3)
            "#,
        )
        .bind(channel_id)
        .bind(role_id)
        .bind(member_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_members_with_channel_permission(
        &self,
        channel_id: Uuid,
        permission: i64,
    ) -> Result<Vec<Uuid>> {
        let member_ids: Vec<(Uuid,)> = sqlx::query_as(
            r#"
            WITH member_permissions AS (
                SELECT
                    m.id as member_id,
                    COALESCE(
                        (SELECT SUM(r.permissions) FROM roles r
                         INNER JOIN member_roles mr ON r.id = mr.role_id
                         WHERE mr.member_id = m.id),
                        0
                    ) as base_permissions
                FROM members m
            ),
            channel_overrides AS (
                SELECT
                    mp.member_id,
                    mp.base_permissions,
                    COALESCE(
                        (SELECT BIT_OR(cpo.allow_permissions) FROM channel_permission_overrides cpo
                         INNER JOIN member_roles mr ON cpo.role_id = mr.role_id
                         WHERE cpo.channel_id = $1 AND mr.member_id = mp.member_id),
                        0
                    ) as role_allow,
                    COALESCE(
                        (SELECT BIT_OR(cpo.deny_permissions) FROM channel_permission_overrides cpo
                         INNER JOIN member_roles mr ON cpo.role_id = mr.role_id
                         WHERE cpo.channel_id = $1 AND mr.member_id = mp.member_id),
                        0
                    ) as role_deny,
                    COALESCE(
                        (SELECT allow_permissions FROM channel_permission_overrides cpo
                         WHERE cpo.channel_id = $1 AND cpo.member_id = mp.member_id),
                        0
                    ) as member_allow,
                    COALESCE(
                        (SELECT deny_permissions FROM channel_permission_overrides cpo
                         WHERE cpo.channel_id = $1 AND cpo.member_id = mp.member_id),
                        0
                    ) as member_deny
                FROM member_permissions mp
            )
            SELECT member_id FROM channel_overrides
            WHERE (
                ((base_permissions | role_allow | member_allow) & ~role_deny & ~member_deny) & $2
            ) != 0
            OR (base_permissions & $3) != 0
            "#,
        )
        .bind(channel_id)
        .bind(permission)
        .bind(1i64 << 9) // ADMINISTRATOR permission
        .fetch_all(&self.pool)
        .await?;
        Ok(member_ids.into_iter().map(|(id,)| id).collect())
    }
}
