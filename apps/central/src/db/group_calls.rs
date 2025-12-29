use chrono::{Duration, Utc};
use sqlx::Row;
use uuid::Uuid;

use super::Database;
use crate::error::{AppError, Result};
use crate::models::{Call, GroupCallParticipant, GroupCallParticipantInfo, ParticipantStatus};

pub const MAX_GROUP_CALL_PARTICIPANTS: i64 = 10;

impl Database {
    pub async fn create_group_call(
        &self,
        call_id: Uuid,
        conversation_id: Uuid,
        initiator_id: Uuid,
    ) -> Result<Call> {
        let mut tx = self.pool.begin().await?;

        let member_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM conversation_members
            WHERE conversation_id = $1
            "#,
        )
        .bind(conversation_id)
        .fetch_one(&mut *tx)
        .await?;

        if member_count < 2 {
            return Err(AppError::BadRequest(
                "Group must have at least 2 members".into(),
            ));
        }

        if member_count > MAX_GROUP_CALL_PARTICIPANTS {
            return Err(AppError::BadRequest(format!(
                "Group exceeds maximum call size of {} participants",
                MAX_GROUP_CALL_PARTICIPANTS
            )));
        }

        let existing_call: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT id FROM calls
            WHERE conversation_id = $1
            AND call_type = 'group'
            AND status IN ('pending', 'ringing', 'connecting', 'active')
            LIMIT 1
            FOR UPDATE
            "#,
        )
        .bind(conversation_id)
        .fetch_optional(&mut *tx)
        .await?;

        if existing_call.is_some() {
            return Err(AppError::BadRequest(
                "Group already has an active call".into(),
            ));
        }

        let call = sqlx::query_as::<_, Call>(
            r#"
            INSERT INTO calls (
                id, call_type, initiator_id, conversation_id,
                status, ring_started_at
            )
            VALUES ($1, 'group', $2, $3, 'ringing', NOW())
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(initiator_id)
        .bind(conversation_id)
        .fetch_one(&mut *tx)
        .await?;

        let member_ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT user_id FROM conversation_members
            WHERE conversation_id = $1
            "#,
        )
        .bind(conversation_id)
        .fetch_all(&mut *tx)
        .await?;

        for member_id in member_ids {
            let status = if member_id == initiator_id {
                ParticipantStatus::Active
            } else {
                ParticipantStatus::Ringing
            };

            let joined_at = if member_id == initiator_id {
                Some(Utc::now())
            } else {
                None
            };

            sqlx::query(
                r#"
                INSERT INTO group_call_participants (call_id, user_id, status, joined_at)
                VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(call_id)
            .bind(member_id)
            .bind(status.as_str())
            .bind(joined_at)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(call)
    }

    pub async fn get_group_call(&self, call_id: Uuid) -> Result<Option<Call>> {
        let call =
            sqlx::query_as::<_, Call>("SELECT * FROM calls WHERE id = $1 AND call_type = 'group'")
                .bind(call_id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(call)
    }

    pub async fn get_group_call_for_participant(
        &self,
        call_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            SELECT c.* FROM calls c
            JOIN group_call_participants p ON p.call_id = c.id
            WHERE c.id = $1 AND c.call_type = 'group' AND p.user_id = $2
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn get_group_call_participant(
        &self,
        call_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<GroupCallParticipant>> {
        let participant = sqlx::query_as::<_, GroupCallParticipant>(
            r#"
            SELECT * FROM group_call_participants
            WHERE call_id = $1 AND user_id = $2
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(participant)
    }

    pub async fn get_group_call_participants(
        &self,
        call_id: Uuid,
    ) -> Result<Vec<GroupCallParticipant>> {
        let participants = sqlx::query_as::<_, GroupCallParticipant>(
            r#"
            SELECT * FROM group_call_participants
            WHERE call_id = $1
            ORDER BY joined_at ASC NULLS LAST
            "#,
        )
        .bind(call_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(participants)
    }

    pub async fn get_group_call_participants_with_info(
        &self,
        call_id: Uuid,
    ) -> Result<Vec<GroupCallParticipantInfo>> {
        let rows = sqlx::query(
            r#"
            SELECT
                p.user_id, p.status, p.is_muted, p.joined_at,
                u.username, pr.display_name, pr.avatar_url
            FROM group_call_participants p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN user_profiles pr ON pr.user_id = p.user_id
            WHERE p.call_id = $1
            ORDER BY p.joined_at ASC NULLS LAST
            "#,
        )
        .bind(call_id)
        .fetch_all(&self.pool)
        .await?;

        let participants = rows
            .into_iter()
            .map(|row| {
                let status_str: String = row.get("status");
                GroupCallParticipantInfo {
                    user_id: row.get("user_id"),
                    username: row.get("username"),
                    display_name: row.get("display_name"),
                    avatar_url: row.get("avatar_url"),
                    status: ParticipantStatus::from_str(&status_str)
                        .unwrap_or(ParticipantStatus::Left),
                    is_muted: row.get("is_muted"),
                    joined_at: row.get("joined_at"),
                }
            })
            .collect();

        Ok(participants)
    }

    pub async fn get_active_participants_with_info(
        &self,
        call_id: Uuid,
    ) -> Result<Vec<GroupCallParticipantInfo>> {
        let rows = sqlx::query(
            r#"
            SELECT
                p.user_id, p.status, p.is_muted, p.joined_at,
                u.username, pr.display_name, pr.avatar_url
            FROM group_call_participants p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN user_profiles pr ON pr.user_id = p.user_id
            WHERE p.call_id = $1 AND p.status IN ('ringing', 'connecting', 'active')
            ORDER BY p.joined_at ASC NULLS LAST
            "#,
        )
        .bind(call_id)
        .fetch_all(&self.pool)
        .await?;

        let participants = rows
            .into_iter()
            .map(|row| {
                let status_str: String = row.get("status");
                GroupCallParticipantInfo {
                    user_id: row.get("user_id"),
                    username: row.get("username"),
                    display_name: row.get("display_name"),
                    avatar_url: row.get("avatar_url"),
                    status: ParticipantStatus::from_str(&status_str)
                        .unwrap_or(ParticipantStatus::Left),
                    is_muted: row.get("is_muted"),
                    joined_at: row.get("joined_at"),
                }
            })
            .collect();

        Ok(participants)
    }

    pub async fn join_group_call(
        &self,
        call_id: Uuid,
        user_id: Uuid,
        encrypted_sender_key: Option<&[u8]>,
    ) -> Result<GroupCallParticipant> {
        let mut tx = self.pool.begin().await?;

        let participant = sqlx::query_as::<_, GroupCallParticipant>(
            r#"
            UPDATE group_call_participants
            SET status = 'active', joined_at = NOW(), encrypted_sender_key = $3
            WHERE call_id = $1 AND user_id = $2
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .bind(encrypted_sender_key)
        .fetch_one(&mut *tx)
        .await?;

        let active_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM group_call_participants
            WHERE call_id = $1 AND status = 'active'
            "#,
        )
        .bind(call_id)
        .fetch_one(&mut *tx)
        .await?;

        if active_count >= 2 {
            sqlx::query(
                r#"
                UPDATE calls
                SET status = 'active', connected_at = COALESCE(connected_at, NOW())
                WHERE id = $1 AND status != 'active'
                "#,
            )
            .bind(call_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(participant)
    }

    pub async fn decline_group_call(&self, call_id: Uuid, user_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE group_call_participants
            SET status = 'declined'
            WHERE call_id = $1 AND user_id = $2 AND status = 'ringing'
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn leave_group_call(&self, call_id: Uuid, user_id: Uuid) -> Result<bool> {
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            UPDATE group_call_participants
            SET status = 'left', left_at = NOW()
            WHERE call_id = $1 AND user_id = $2
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        let active_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM group_call_participants
            WHERE call_id = $1 AND status = 'active'
            "#,
        )
        .bind(call_id)
        .fetch_one(&mut *tx)
        .await?;

        if active_count == 0 {
            sqlx::query(
                r#"
                UPDATE calls
                SET status = 'ended', end_reason = 'normal', ended_at = NOW(),
                    duration_seconds = CASE
                        WHEN connected_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                        ELSE NULL
                    END
                WHERE id = $1 AND status NOT IN ('ended', 'cancelled')
                "#,
            )
            .bind(call_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            return Ok(true);
        }

        tx.commit().await?;
        Ok(false)
    }

    pub async fn end_group_call(&self, call_id: Uuid) -> Result<Call> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls
            SET status = 'ended', end_reason = 'normal', ended_at = NOW(),
                duration_seconds = CASE
                    WHEN connected_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
                    ELSE NULL
                END
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(call_id)
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            UPDATE group_call_participants
            SET status = 'left', left_at = NOW()
            WHERE call_id = $1 AND status IN ('ringing', 'connecting', 'active')
            "#,
        )
        .bind(call_id)
        .execute(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn update_group_call_mute(
        &self,
        call_id: Uuid,
        user_id: Uuid,
        is_muted: bool,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE group_call_participants
            SET is_muted = $3
            WHERE call_id = $1 AND user_id = $2
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .bind(is_muted)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_active_group_call_for_conversation(
        &self,
        conversation_id: Uuid,
    ) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            SELECT * FROM calls
            WHERE conversation_id = $1
            AND call_type = 'group'
            AND status IN ('ringing', 'connecting', 'active')
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(conversation_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn get_active_group_call_for_user(&self, user_id: Uuid) -> Result<Option<Call>> {
        let call = sqlx::query_as::<_, Call>(
            r#"
            SELECT c.* FROM calls c
            JOIN group_call_participants p ON p.call_id = c.id
            WHERE p.user_id = $1
            AND c.call_type = 'group'
            AND c.status IN ('ringing', 'connecting', 'active')
            AND p.status IN ('ringing', 'connecting', 'active')
            ORDER BY c.created_at DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(call)
    }

    pub async fn get_group_call_participant_count(&self, call_id: Uuid) -> Result<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM group_call_participants
            WHERE call_id = $1 AND status = 'active'
            "#,
        )
        .bind(call_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    pub async fn timeout_stale_group_calls(&self) -> Result<Vec<Call>> {
        let timeout = Utc::now() - Duration::seconds(60);

        let calls = sqlx::query_as::<_, Call>(
            r#"
            UPDATE calls
            SET status = 'missed', end_reason = 'timeout', ended_at = NOW()
            WHERE call_type = 'group'
            AND status = 'ringing'
            AND ring_started_at < $1
            AND id NOT IN (
                SELECT call_id FROM group_call_participants
                WHERE status = 'active'
            )
            RETURNING *
            "#,
        )
        .bind(timeout)
        .fetch_all(&self.pool)
        .await?;

        for call in &calls {
            sqlx::query(
                r#"
                UPDATE group_call_participants
                SET status = 'left'
                WHERE call_id = $1 AND status = 'ringing'
                "#,
            )
            .bind(call.id)
            .execute(&self.pool)
            .await?;
        }

        Ok(calls)
    }

    pub async fn update_participant_sender_key(
        &self,
        call_id: Uuid,
        user_id: Uuid,
        encrypted_sender_key: &[u8],
        key_version: i32,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE group_call_participants
            SET encrypted_sender_key = $3, sender_key_version = $4
            WHERE call_id = $1 AND user_id = $2
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .bind(encrypted_sender_key)
        .bind(key_version)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_participant_sender_key(
        &self,
        call_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<(Vec<u8>, i32)>> {
        let row = sqlx::query(
            r#"
            SELECT encrypted_sender_key, sender_key_version
            FROM group_call_participants
            WHERE call_id = $1 AND user_id = $2
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => {
                let key: Option<Vec<u8>> = row.get("encrypted_sender_key");
                let version: Option<i32> = row.get("sender_key_version");
                match (key, version) {
                    (Some(k), Some(v)) => Ok(Some((k, v))),
                    _ => Ok(None),
                }
            }
            None => Ok(None),
        }
    }

    pub async fn get_group_call_member_ids(&self, call_id: Uuid) -> Result<Vec<Uuid>> {
        let ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT user_id FROM group_call_participants
            WHERE call_id = $1
            "#,
        )
        .bind(call_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(ids)
    }

    pub async fn get_active_group_call_member_ids(&self, call_id: Uuid) -> Result<Vec<Uuid>> {
        let ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT user_id FROM group_call_participants
            WHERE call_id = $1 AND status = 'active'
            "#,
        )
        .bind(call_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(ids)
    }

    pub async fn rejoin_group_call(
        &self,
        call_id: Uuid,
        user_id: Uuid,
        rejoin_window_seconds: i64,
    ) -> Result<GroupCallParticipant> {
        let window = Utc::now() - Duration::seconds(rejoin_window_seconds);
        let mut tx = self.pool.begin().await?;

        let call = sqlx::query_as::<_, Call>(
            r#"
            SELECT c.* FROM calls c
            JOIN group_call_participants p ON p.call_id = c.id
            WHERE c.id = $1 AND c.call_type = 'group' AND p.user_id = $2
            FOR UPDATE OF c
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("Call not found".into()))?;

        let participant = sqlx::query_as::<_, GroupCallParticipant>(
            r#"
            SELECT * FROM group_call_participants
            WHERE call_id = $1 AND user_id = $2
            FOR UPDATE
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        if participant.status != "left" {
            return Err(AppError::BadRequest(
                "Can only rejoin if you have left the call".into(),
            ));
        }

        if let Some(left_at) = participant.left_at {
            if left_at < window {
                return Err(AppError::BadRequest("Rejoin window has expired".into()));
            }
        }

        let status = call.get_status();
        let needs_reopen = matches!(status, Some(crate::models::CallStatus::Ended));

        if needs_reopen {
            if let Some(ended_at) = call.ended_at {
                if ended_at < window {
                    return Err(AppError::BadRequest(
                        "Call ended too long ago to rejoin".into(),
                    ));
                }
            }

            let existing_active: Option<(Uuid,)> = sqlx::query_as(
                r#"
                SELECT id FROM calls
                WHERE conversation_id = $1
                AND call_type = 'group'
                AND status IN ('pending', 'ringing', 'connecting', 'active')
                AND id != $2
                LIMIT 1
                "#,
            )
            .bind(call.conversation_id)
            .bind(call_id)
            .fetch_optional(&mut *tx)
            .await?;

            if existing_active.is_some() {
                return Err(AppError::BadRequest(
                    "Another call is already active in this conversation".into(),
                ));
            }

            sqlx::query(
                r#"
                UPDATE calls
                SET status = 'active', ended_at = NULL, end_reason = NULL
                WHERE id = $1
                "#,
            )
            .bind(call_id)
            .execute(&mut *tx)
            .await?;
        }

        let updated_participant = sqlx::query_as::<_, GroupCallParticipant>(
            r#"
            UPDATE group_call_participants
            SET status = 'active', left_at = NULL
            WHERE call_id = $1 AND user_id = $2
            RETURNING *
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated_participant)
    }

    pub async fn is_group_call_rejoinable(
        &self,
        call_id: Uuid,
        user_id: Uuid,
        rejoin_window_seconds: i64,
    ) -> Result<bool> {
        let window = Utc::now() - Duration::seconds(rejoin_window_seconds);

        let result: Option<(bool,)> = sqlx::query_as(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM group_call_participants p
                JOIN calls c ON c.id = p.call_id
                WHERE p.call_id = $1
                AND p.user_id = $2
                AND p.status = 'left'
                AND (p.left_at IS NULL OR p.left_at > $3)
                AND (c.ended_at IS NULL OR c.ended_at > $3)
                AND c.call_type = 'group'
            )
            "#,
        )
        .bind(call_id)
        .bind(user_id)
        .bind(window)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|r| r.0).unwrap_or(false))
    }
}
