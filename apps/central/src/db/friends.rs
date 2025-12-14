use uuid::Uuid;

use crate::error::Result;
use crate::models::{FriendRequest, UserFriends};

use super::Database;

impl Database {
    pub async fn get_user_friends(&self, user_id: Uuid) -> Result<Option<UserFriends>> {
        let friends =
            sqlx::query_as::<_, UserFriends>("SELECT * FROM user_friends WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(friends)
    }

    pub async fn update_user_friends(
        &self,
        user_id: Uuid,
        encrypted_friends: Vec<u8>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO user_friends (user_id, encrypted_friends, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET encrypted_friends = $2, updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(encrypted_friends)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn create_friend_request(
        &self,
        from_user_id: Uuid,
        to_user_id: Uuid,
        encrypted_message: Option<Vec<u8>>,
    ) -> Result<FriendRequest> {
        let request = sqlx::query_as::<_, FriendRequest>(
            r#"
            INSERT INTO friend_requests (from_user_id, to_user_id, encrypted_message)
            VALUES ($1, $2, $3)
            ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET
                encrypted_message = $3, created_at = NOW()
            RETURNING *
            "#,
        )
        .bind(from_user_id)
        .bind(to_user_id)
        .bind(encrypted_message)
        .fetch_one(&self.pool)
        .await?;
        Ok(request)
    }

    pub async fn get_friend_requests_for_user(&self, user_id: Uuid) -> Result<Vec<FriendRequest>> {
        let requests = sqlx::query_as::<_, FriendRequest>(
            "SELECT * FROM friend_requests WHERE to_user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(requests)
    }

    pub async fn get_sent_friend_requests(&self, user_id: Uuid) -> Result<Vec<FriendRequest>> {
        let requests = sqlx::query_as::<_, FriendRequest>(
            "SELECT * FROM friend_requests WHERE from_user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(requests)
    }

    pub async fn get_friend_request(&self, id: Uuid) -> Result<Option<FriendRequest>> {
        let request =
            sqlx::query_as::<_, FriendRequest>("SELECT * FROM friend_requests WHERE id = $1")
                .bind(id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(request)
    }

    pub async fn get_reverse_friend_request(
        &self,
        from_user_id: Uuid,
        to_user_id: Uuid,
    ) -> Result<Option<FriendRequest>> {
        let request = sqlx::query_as::<_, FriendRequest>(
            "SELECT * FROM friend_requests WHERE from_user_id = $1 AND to_user_id = $2",
        )
        .bind(to_user_id)
        .bind(from_user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(request)
    }

    pub async fn delete_friend_request(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM friend_requests WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_friend_requests_between(&self, user_a: Uuid, user_b: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            DELETE FROM friend_requests
            WHERE (from_user_id = $1 AND to_user_id = $2)
               OR (from_user_id = $2 AND to_user_id = $1)
            "#,
        )
        .bind(user_a)
        .bind(user_b)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
