use uuid::Uuid;

use crate::error::Result;
use crate::models::Role;

use super::Database;

impl Database {
    pub async fn create_role(
        &self,
        name: String,
        permissions: i64,
        color: Option<String>,
        position: i32,
    ) -> Result<Role> {
        let role = sqlx::query_as::<_, Role>(
            r#"
            INSERT INTO roles (name, permissions, color, position)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(name)
        .bind(permissions)
        .bind(color)
        .bind(position)
        .fetch_one(&self.pool)
        .await?;
        Ok(role)
    }

    pub async fn get_role(&self, role_id: Uuid) -> Result<Option<Role>> {
        let role = sqlx::query_as::<_, Role>("SELECT * FROM roles WHERE id = $1")
            .bind(role_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(role)
    }

    pub async fn get_all_roles(&self) -> Result<Vec<Role>> {
        let roles = sqlx::query_as::<_, Role>("SELECT * FROM roles ORDER BY position DESC")
            .fetch_all(&self.pool)
            .await?;
        Ok(roles)
    }

    pub async fn update_role(
        &self,
        role_id: Uuid,
        name: Option<String>,
        permissions: Option<i64>,
        color: Option<String>,
        position: Option<i32>,
    ) -> Result<()> {
        let mut query = String::from("UPDATE roles SET ");
        let mut params: Vec<String> = vec![];
        let mut param_count = 1;

        if name.is_some() {
            params.push(format!("name = ${}", param_count));
            param_count += 1;
        }
        if permissions.is_some() {
            params.push(format!("permissions = ${}", param_count));
            param_count += 1;
        }
        if color.is_some() {
            params.push(format!("color = ${}", param_count));
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
        if let Some(p) = permissions {
            q = q.bind(p);
        }
        if let Some(c) = color {
            q = q.bind(c);
        }
        if let Some(pos) = position {
            q = q.bind(pos);
        }

        q = q.bind(role_id);
        q.execute(&self.pool).await?;

        use crate::db::cache::invalidate_cache_pattern;
        invalidate_cache_pattern(self.redis_client(), "permissions:*").await?;

        Ok(())
    }

    pub async fn delete_role(&self, role_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM roles WHERE id = $1")
            .bind(role_id)
            .execute(&self.pool)
            .await?;

        use crate::db::cache::invalidate_cache_pattern;
        invalidate_cache_pattern(self.redis_client(), "permissions:*").await?;

        Ok(())
    }

    pub async fn reorder_roles(&self, role_ids: Vec<Uuid>) -> Result<Vec<Role>> {
        let mut tx = self.pool.begin().await?;

        let len = role_ids.len() as i32;
        for (idx, role_id) in role_ids.into_iter().enumerate() {
            let position = len - 1 - (idx as i32);
            sqlx::query("UPDATE roles SET position = $1 WHERE id = $2")
                .bind(position)
                .bind(role_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        self.get_all_roles().await
    }

    async fn get_member_permissions_uncached(&self, member_id: Uuid) -> Result<i64> {
        use crate::models::permissions::DEFAULT_MEMBER;

        let result: Option<(Option<Uuid>, Option<Uuid>, i64)> = sqlx::query_as(
            r#"
            SELECT
                si.owner_user_id,
                m.central_user_id,
                COALESCE(SUM(r.permissions), 0) as total_permissions
            FROM members m
            LEFT JOIN server_identity si ON true
            LEFT JOIN member_roles mr ON m.id = mr.member_id
            LEFT JOIN roles r ON mr.role_id = r.id
            WHERE m.id = $1
            GROUP BY si.owner_user_id, m.central_user_id
            "#,
        )
        .bind(member_id)
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some((Some(owner_id), Some(central_user_id), _)) if owner_id == central_user_id => {
                Ok(i64::MAX)
            }
            Some((_, _, perms)) => Ok(DEFAULT_MEMBER | perms),
            None => Ok(DEFAULT_MEMBER),
        }
    }

    pub async fn get_member_permissions(&self, member_id: Uuid) -> Result<i64> {
        use crate::db::cache::cached_get;

        let cache_key = format!("permissions:{}", member_id);

        let db = self.clone();
        let result = cached_get(self.redis_client(), &cache_key, 300, || async move {
            db.get_member_permissions_uncached(member_id)
                .await
                .map_err(|e| anyhow::anyhow!("{:?}", e))
        })
        .await
        .map_err(|e| e.into());

        result
    }
}
