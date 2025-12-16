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

        Ok(())
    }

    pub async fn delete_role(&self, role_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM roles WHERE id = $1")
            .bind(role_id)
            .execute(&self.pool)
            .await?;
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

    pub async fn get_member_permissions(&self, member_id: Uuid) -> Result<i64> {
        use crate::models::permissions::DEFAULT_MEMBER;

        let identity = self.get_server_identity().await?;
        if let Some(id) = identity {
            if let Some(owner_id) = id.owner_user_id {
                let member = self.get_member(member_id).await?;
                if let Some(m) = member {
                    if m.central_user_id == owner_id {
                        return Ok(i64::MAX);
                    }
                }
            }
        }

        let roles: Vec<(i64,)> = sqlx::query_as(
            r#"
            SELECT r.permissions FROM roles r
            JOIN member_roles mr ON r.id = mr.role_id
            WHERE mr.member_id = $1
            "#,
        )
        .bind(member_id)
        .fetch_all(&self.pool)
        .await?;

        let mut permissions: i64 = DEFAULT_MEMBER;
        for (p,) in roles {
            permissions |= p;
        }

        Ok(permissions)
    }
}
