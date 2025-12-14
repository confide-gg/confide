use chrono::{DateTime, Utc};
use sqlx::Error;
use uuid::Uuid;

use super::Database;
use crate::models::{PublicProfile, UpdateProfileRequest, UserProfile};

impl Database {
    pub async fn get_profile(&self, user_id: Uuid) -> Result<Option<UserProfile>, Error> {
        sqlx::query_as::<_, UserProfile>(
            r#"SELECT user_id, display_name, avatar_url, bio, status, custom_status, accent_color, banner_url, created_at, updated_at
               FROM user_profiles WHERE user_id = $1"#
        )
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
    }

    pub async fn get_public_profile(&self, user_id: Uuid) -> Result<Option<PublicProfile>, Error> {
        let row = sqlx::query_as::<
            _,
            (
                Uuid,
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                DateTime<Utc>,
            ),
        >(
            r#"
            SELECT
                u.id,
                u.username,
                p.display_name,
                p.avatar_url,
                p.bio,
                COALESCE(p.status, 'online') as status,
                p.custom_status,
                p.accent_color,
                p.banner_url,
                u.created_at
            FROM users u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE u.id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(
            |(
                user_id,
                username,
                display_name,
                avatar_url,
                bio,
                status,
                custom_status,
                accent_color,
                banner_url,
                member_since,
            )| {
                PublicProfile {
                    user_id,
                    username,
                    display_name,
                    avatar_url,
                    bio,
                    status,
                    custom_status,
                    accent_color,
                    banner_url,
                    member_since,
                }
            },
        ))
    }

    pub async fn create_profile(&self, user_id: Uuid) -> Result<UserProfile, Error> {
        sqlx::query_as::<_, UserProfile>(
            r#"
            INSERT INTO user_profiles (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING user_id, display_name, avatar_url, bio, status, custom_status, accent_color, banner_url, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update_profile(
        &self,
        user_id: Uuid,
        req: &UpdateProfileRequest,
    ) -> Result<UserProfile, Error> {
        sqlx::query_as::<_, UserProfile>(
            r#"
            INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, status, custom_status, accent_color, banner_url)
            VALUES ($1, $2, $3, $4, COALESCE($5, 'online'), $6, $7, $8)
            ON CONFLICT (user_id) DO UPDATE SET
                display_name = COALESCE($2, user_profiles.display_name),
                avatar_url = COALESCE($2, user_profiles.avatar_url),
                bio = COALESCE($4, user_profiles.bio),
                status = COALESCE($5, user_profiles.status),
                custom_status = COALESCE($6, user_profiles.custom_status),
                accent_color = COALESCE($7, user_profiles.accent_color),
                banner_url = COALESCE($8, user_profiles.banner_url),
                updated_at = NOW()
            RETURNING user_id, display_name, avatar_url, bio, status, custom_status, accent_color, banner_url, created_at, updated_at
            "#
        )
        .bind(user_id)
        .bind(&req.display_name)
        .bind(&req.avatar_url)
        .bind(&req.bio)
        .bind(&req.status)
        .bind(&req.custom_status)
        .bind(&req.accent_color)
        .bind(&req.banner_url)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update_status(&self, user_id: Uuid, status: &str) -> Result<(), Error> {
        sqlx::query(
            r#"
            INSERT INTO user_profiles (user_id, status)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET
                status = $2,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(status)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_user_status(&self, user_id: Uuid) -> Result<String, Error> {
        let result: Option<(String,)> =
            sqlx::query_as("SELECT status FROM user_profiles WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(&self.ws_pool)
                .await?;

        Ok(result.map(|(s,)| s).unwrap_or_else(|| "online".to_string()))
    }

    pub async fn get_user_presence_data(
        &self,
        user_id: Uuid,
    ) -> Result<(String, Option<String>), Error> {
        let result: Option<(String, Option<String>)> =
            sqlx::query_as("SELECT COALESCE(status, 'online'), custom_status FROM user_profiles WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(&self.ws_pool)
                .await?;

        Ok(result.unwrap_or_else(|| ("online".to_string(), None)))
    }

    pub async fn update_user_presence(
        &self,
        user_id: Uuid,
        status: &str,
        custom_status: Option<&str>,
    ) -> Result<(), Error> {
        sqlx::query(
            r#"
            INSERT INTO user_profiles (user_id, status, custom_status)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                status = $2,
                custom_status = $3,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(status)
        .bind(custom_status)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_profile_image(
        &self,
        user_id: Uuid,
        file_type: &str,
        url: &str,
    ) -> Result<(), Error> {
        let query = if file_type == "avatar" {
            r#"
            INSERT INTO user_profiles (user_id, avatar_url)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET
                avatar_url = $2,
                updated_at = NOW()
            "#
        } else {
            r#"
            INSERT INTO user_profiles (user_id, banner_url)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET
                banner_url = $2,
                updated_at = NOW()
            "#
        };

        sqlx::query(query)
            .bind(user_id)
            .bind(url)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn clear_profile_image(&self, user_id: Uuid, file_type: &str) -> Result<(), Error> {
        let query = if file_type == "avatar" {
            "UPDATE user_profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = $1"
        } else {
            "UPDATE user_profiles SET banner_url = NULL, updated_at = NOW() WHERE user_id = $1"
        };

        sqlx::query(query).bind(user_id).execute(&self.pool).await?;

        Ok(())
    }
}
