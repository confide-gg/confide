use uuid::Uuid;

use crate::error::Result;
use crate::models::{Category, Invite, TextChannel};

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

    pub async fn increment_invite_uses(&self, invite_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE invites SET uses = uses + 1 WHERE id = $1")
            .bind(invite_id)
            .execute(&self.pool)
            .await?;
        Ok(())
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
}
