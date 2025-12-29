use chrono::{DateTime, Duration, Utc};
use sqlx::Row;
use uuid::Uuid;

use super::Database;
use crate::error::{AppError, Result};
use crate::models::{Call, CallEndReason, CallStatus};

impl Database {
    pub async fn create_call(
        &self,
        call_id: Uuid,
        caller_id: Uuid,
        callee_id: Uuid,
        conversation_id: Option<Uuid>,
        caller_ephemeral_public: &[u8],
    ) -> Result<Call> {
        let mut tx = self.pool.begin().await?;

        let caller_has_call: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT id FROM calls
            WHERE (caller_id = $1 OR callee_id = $1)
            AND status IN ('pending', 'ringing', 'connecting', 'active')
            LIMIT 1
            FOR UPDATE
            "#,
        )
        .bind(caller_id)
        .fetch_optional(&mut *tx)
        .await?;

        if caller_has_call.is_some() {
            return Err(crate::error::AppError::BadRequest(
                "You already have an active call".into(),
            ));
        }

        let callee_has_call: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT id FROM calls
            WHERE (caller_id = $1 OR callee_id = $1)
            AND status IN ('pending', 'ringing', 'connecting', 'active')
            LIMIT 1
            FOR UPDATE
            "#,
        )
        .bind(callee_id)
        .fetch_optional(&mut *tx)
        .await?;

        if callee_has_call.is_some() {
            return Err(crate::error::AppError::BadRequest("User is busy".into()));
        }

        let call = sqlx::query_as::<_, Call>(
            r#"
            INSERT INTO calls (
                id, caller_id, callee_id, conversation_id,
                caller_ephemeral_public, status, ring_started_at
            )
            VALUES ($1, $2, $3, $4, $5, 'ringing', NOW())
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(caller_id)
        .bind(callee_id)
        .bind(conversation_id)
        .bind(caller_ephemeral_public)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(call)
    }

    pub async fn get_call(&self, call_id: Uuid) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>("SELECT * FROM calls WHERE id = $1")
            .bind(call_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(call)
    }

    pub async fn get_call_for_participant(
        &self,
        call_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>(
            "SELECT * FROM calls WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)",
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn get_active_call_for_user(&self, user_id: Uuid) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            SELECT * FROM calls 
            WHERE (caller_id = $1 OR callee_id = $1)
            AND status IN ('pending', 'ringing', 'connecting', 'active')
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn user_has_active_call(&self, user_id: Uuid) -> Result<bool> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM calls 
            WHERE (caller_id = $1 OR callee_id = $1)
            AND status IN ('pending', 'ringing', 'connecting', 'active')
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    pub async fn update_call_status(&self, call_id: Uuid, status: CallStatus) -> Result<Call> {
        let status_str = status.as_str();

        let call = match status {
            CallStatus::Connecting => {
                sqlx::query_as::<_, Call>(
                    r#"
                    UPDATE calls 
                    SET status = $2, answered_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    "#,
                )
                .bind(call_id)
                .bind(status_str)
                .fetch_one(&self.pool)
                .await?
            }
            CallStatus::Active => {
                sqlx::query_as::<_, Call>(
                    r#"
                    UPDATE calls 
                    SET status = $2, connected_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    "#,
                )
                .bind(call_id)
                .bind(status_str)
                .fetch_one(&self.pool)
                .await?
            }
            _ => {
                sqlx::query_as::<_, Call>(
                    r#"
                    UPDATE calls 
                    SET status = $2
                    WHERE id = $1
                    RETURNING *
                    "#,
                )
                .bind(call_id)
                .bind(status_str)
                .fetch_one(&self.pool)
                .await?
            }
        };

        Ok(call)
    }

    pub async fn end_call(
        &self,
        call_id: Uuid,
        status: CallStatus,
        reason: CallEndReason,
    ) -> Result<Call> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls
            SET status = $2,
                end_reason = $3,
                ended_at = NOW(),
                duration_seconds = CASE
                    WHEN connected_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                    ELSE NULL
                END,
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(status.as_str())
        .bind(reason.as_str())
        .fetch_one(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn try_end_call(
        &self,
        call_id: Uuid,
        status: CallStatus,
        reason: CallEndReason,
    ) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls
            SET status = $2,
                end_reason = $3,
                ended_at = NOW(),
                duration_seconds = CASE
                    WHEN connected_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                    ELSE NULL
                END,
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE id = $1
            AND status NOT IN ('ended', 'missed', 'rejected', 'cancelled')
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(status.as_str())
        .bind(reason.as_str())
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn set_callee_ephemeral_public(
        &self,
        call_id: Uuid,
        callee_ephemeral_public: &[u8],
    ) -> Result<Call> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls 
            SET callee_ephemeral_public = $2
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(callee_ephemeral_public)
        .fetch_one(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn set_relay_token(
        &self,
        call_id: Uuid,
        token_hash: &[u8],
        expires_at: DateTime<Utc>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE calls 
            SET relay_token_hash = $2, relay_token_expires_at = $3
            WHERE id = $1
            "#,
        )
        .bind(call_id)
        .bind(token_hash)
        .bind(expires_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_call_history(
        &self,
        user_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Call>> {
        let calls = sqlx::query_as::<_, Call>(
            r#"
            SELECT * FROM calls 
            WHERE (caller_id = $1 OR callee_id = $1)
            AND status IN ('ended', 'missed', 'rejected', 'cancelled')
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(calls)
    }

    pub async fn get_missed_calls(&self, user_id: Uuid) -> Result<Vec<Call>> {
        let calls = sqlx::query_as::<_, Call>(
            r#"
            SELECT * FROM calls 
            WHERE callee_id = $1 AND status = 'missed'
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(calls)
    }

    pub async fn timeout_stale_calls(&self) -> Result<Vec<Call>> {
        let timeout = Utc::now() - Duration::seconds(30);

        let calls = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls 
            SET status = 'missed', 
                end_reason = 'timeout', 
                ended_at = NOW(),
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE status = 'ringing' 
            AND ring_started_at < $1
            RETURNING *
            "#,
        )
        .bind(timeout)
        .fetch_all(&self.pool)
        .await?;

        Ok(calls)
    }

    pub async fn cleanup_expired_calls(&self) -> Result<u64> {
        let max_duration = Utc::now() - Duration::minutes(120);

        let result = sqlx::query(
            r#"
            UPDATE calls 
            SET status = 'ended', 
                end_reason = 'timeout', 
                ended_at = NOW(),
                duration_seconds = CASE 
                    WHEN connected_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                    ELSE NULL
                END,
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE status = 'active' 
            AND connected_at < $1
            "#,
        )
        .bind(max_duration)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn leave_call(&self, call_id: Uuid, user_id: Uuid) -> Result<Call> {
        let call = self
            .get_call_for_participant(call_id, user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

        let is_caller = call.caller_id == Some(user_id);

        let call = if is_caller {
            sqlx::query_as::<_, Call>(
                r#"
                UPDATE calls
                SET caller_left_at = NOW()
                WHERE id = $1
                RETURNING *
                "#,
            )
            .bind(call_id)
            .fetch_one(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Call>(
                r#"
                UPDATE calls
                SET callee_left_at = NOW()
                WHERE id = $1
                RETURNING *
                "#,
            )
            .bind(call_id)
            .fetch_one(&self.pool)
            .await?
        };

        Ok(call)
    }

    pub async fn rejoin_call(&self, call_id: Uuid, user_id: Uuid) -> Result<Call> {
        let call = self
            .get_call_for_participant(call_id, user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

        let is_caller = call.caller_id == Some(user_id);

        let call = if is_caller {
            sqlx::query_as::<_, Call>(
                r#"
                UPDATE calls
                SET caller_left_at = NULL
                WHERE id = $1
                RETURNING *
                "#,
            )
            .bind(call_id)
            .fetch_one(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Call>(
                r#"
                UPDATE calls
                SET callee_left_at = NULL
                WHERE id = $1
                RETURNING *
                "#,
            )
            .bind(call_id)
            .fetch_one(&self.pool)
            .await?
        };

        Ok(call)
    }

    pub async fn get_rejoinable_call(
        &self,
        user_id: Uuid,
        rejoin_window_seconds: i64,
    ) -> Result<Option<Call>> {
        let window = Utc::now() - Duration::seconds(rejoin_window_seconds);

        let call = sqlx::query_as::<_, Call>(
            r#"
            SELECT * FROM calls
            WHERE status = 'active'
            AND (
                (caller_id = $1 AND caller_left_at IS NOT NULL AND caller_left_at > $2)
                OR
                (callee_id = $1 AND callee_left_at IS NOT NULL AND callee_left_at > $2)
            )
            ORDER BY
                CASE
                    WHEN caller_id = $1 THEN caller_left_at
                    ELSE callee_left_at
                END DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .bind(window)
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn end_calls_with_both_left(
        &self,
        _max_leave_duration_seconds: i64,
    ) -> Result<Vec<Call>> {
        let calls = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls
            SET status = 'ended',
                end_reason = 'normal',
                ended_at = NOW(),
                duration_seconds = CASE
                    WHEN connected_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                    ELSE NULL
                END,
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE status = 'active'
            AND caller_left_at IS NOT NULL
            AND callee_left_at IS NOT NULL
            RETURNING *
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(calls)
    }

    pub async fn end_abandoned_calls(&self, rejoin_window_seconds: i64) -> Result<Vec<Call>> {
        let threshold = Utc::now() - Duration::seconds(rejoin_window_seconds);

        let calls = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls
            SET status = 'ended',
                end_reason = 'timeout',
                ended_at = NOW(),
                duration_seconds = CASE
                    WHEN connected_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                    ELSE NULL
                END,
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE status = 'active'
            AND (
                (caller_left_at IS NOT NULL AND caller_left_at < $1 AND callee_left_at IS NULL)
                OR
                (callee_left_at IS NOT NULL AND callee_left_at < $1 AND caller_left_at IS NULL)
            )
            RETURNING *
            "#,
        )
        .bind(threshold)
        .fetch_all(&self.pool)
        .await?;

        Ok(calls)
    }

    pub async fn cleanup_stale_connecting_calls(&self) -> Result<Vec<Call>> {
        let timeout = Utc::now() - Duration::seconds(60);

        let calls = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls 
            SET status = 'ended', 
                end_reason = 'timeout', 
                ended_at = NOW(),
                caller_ephemeral_public = NULL,
                callee_ephemeral_public = NULL
            WHERE status = 'connecting' 
            AND answered_at < $1
            RETURNING *
            "#,
        )
        .bind(timeout)
        .fetch_all(&self.pool)
        .await?;

        Ok(calls)
    }

    pub async fn cleanup_orphaned_calls(&self) -> Result<u64> {
        let cutoff = Utc::now() - Duration::hours(1);

        let result = sqlx::query(
            r#"
            DELETE FROM calls 
            WHERE status IN ('pending', 'ringing') 
            AND created_at < $1
            AND ring_started_at IS NULL
            "#,
        )
        .bind(cutoff)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn cleanup_inconsistent_calls(&self) -> Result<u64> {
        let result = sqlx::query(
            r#"
            UPDATE calls 
            SET status = 'ended', 
                end_reason = 'inconsistent_state', 
                ended_at = NOW()
            WHERE status = 'active' 
            AND relay_token_hash IS NULL
            AND created_at < $1
            "#,
        )
        .bind(Utc::now() - Duration::hours(2))
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn get_call_with_peer_info(
        &self,
        call_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<(Call, String, Option<String>, Option<String>)>> {
        let row = sqlx::query(
            r#"
            SELECT c.*, u.username, p.display_name, p.avatar_url
            FROM calls c
            JOIN users u ON u.id = CASE 
                WHEN c.caller_id = $2 THEN c.callee_id 
                ELSE c.caller_id 
            END
            LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE c.id = $1 AND (c.caller_id = $2 OR c.callee_id = $2)
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => {
                let call = Call {
                    id: row.get("id"),
                    call_type: row.get("call_type"),
                    caller_id: row.get("caller_id"),
                    callee_id: row.get("callee_id"),
                    initiator_id: row.get("initiator_id"),
                    conversation_id: row.get("conversation_id"),
                    status: row.get("status"),
                    caller_ephemeral_public: row.get("caller_ephemeral_public"),
                    callee_ephemeral_public: row.get("callee_ephemeral_public"),
                    relay_token_hash: row.get("relay_token_hash"),
                    relay_token_expires_at: row.get("relay_token_expires_at"),
                    created_at: row.get("created_at"),
                    ring_started_at: row.get("ring_started_at"),
                    answered_at: row.get("answered_at"),
                    connected_at: row.get("connected_at"),
                    ended_at: row.get("ended_at"),
                    end_reason: row.get("end_reason"),
                    duration_seconds: row.get("duration_seconds"),
                    caller_left_at: row.get("caller_left_at"),
                    callee_left_at: row.get("callee_left_at"),
                };
                let username: String = row.get("username");
                let display_name: Option<String> = row.get("display_name");
                let avatar_url: Option<String> = row.get("avatar_url");
                Ok(Some((call, username, display_name, avatar_url)))
            }
            None => Ok(None),
        }
    }
}
