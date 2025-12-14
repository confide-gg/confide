use uuid::Uuid;

use crate::error::Result;
use crate::models::{
    OneTimePrekey, OneTimePrekeyInfo, PendingKeyExchange, PreKeyBundle, RatchetSession, UserPrekeys,
};

use super::Database;

impl Database {
    pub async fn upsert_user_prekeys(
        &self,
        user_id: Uuid,
        signed_prekey_public: Vec<u8>,
        signed_prekey_signature: Vec<u8>,
        signed_prekey_id: i32,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO user_prekeys (user_id, signed_prekey_public, signed_prekey_signature, signed_prekey_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                signed_prekey_public = $2,
                signed_prekey_signature = $3,
                signed_prekey_id = $4,
                updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(signed_prekey_public)
        .bind(signed_prekey_signature)
        .bind(signed_prekey_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_user_prekeys(&self, user_id: Uuid) -> Result<Option<UserPrekeys>> {
        let prekeys =
            sqlx::query_as::<_, UserPrekeys>("SELECT * FROM user_prekeys WHERE user_id = $1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(prekeys)
    }

    pub async fn add_one_time_prekeys(
        &self,
        user_id: Uuid,
        prekeys: Vec<(i32, Vec<u8>)>,
    ) -> Result<()> {
        for (prekey_id, public_key) in prekeys {
            sqlx::query(
                r#"
                INSERT INTO one_time_prekeys (user_id, prekey_id, public_key)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, prekey_id) DO UPDATE SET public_key = $3
                "#,
            )
            .bind(user_id)
            .bind(prekey_id)
            .bind(public_key)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    pub async fn get_one_time_prekey_count(&self, user_id: Uuid) -> Result<i64> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM one_time_prekeys WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&self.pool)
                .await?;
        Ok(count.0)
    }

    pub async fn claim_one_time_prekey(&self, user_id: Uuid) -> Result<Option<OneTimePrekey>> {
        let prekey = sqlx::query_as::<_, OneTimePrekey>(
            r#"
            DELETE FROM one_time_prekeys
            WHERE id = (
                SELECT id FROM one_time_prekeys
                WHERE user_id = $1
                ORDER BY created_at ASC
                LIMIT 1
            )
            RETURNING *
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(prekey)
    }

    pub async fn get_prekey_bundle(&self, user_id: Uuid) -> Result<Option<PreKeyBundle>> {
        let user = self.get_user_by_id(user_id).await?;
        let user = match user {
            Some(u) => u,
            None => return Ok(None),
        };

        let prekeys = self.get_user_prekeys(user_id).await?;
        let prekeys = match prekeys {
            Some(p) => p,
            None => return Ok(None),
        };

        let one_time = self.claim_one_time_prekey(user_id).await?;

        Ok(Some(PreKeyBundle {
            identity_key: user.kem_public_key,
            signed_prekey_public: prekeys.signed_prekey_public,
            signed_prekey_signature: prekeys.signed_prekey_signature,
            signed_prekey_id: prekeys.signed_prekey_id,
            one_time_prekey: one_time.map(|p| OneTimePrekeyInfo {
                prekey_id: p.prekey_id,
                public_key: p.public_key,
            }),
        }))
    }

    pub async fn upsert_ratchet_session(
        &self,
        user_id: Uuid,
        peer_user_id: Uuid,
        conversation_id: Uuid,
        encrypted_state: Vec<u8>,
    ) -> Result<RatchetSession> {
        let session = sqlx::query_as::<_, RatchetSession>(
            r#"
            INSERT INTO ratchet_sessions (user_id, peer_user_id, conversation_id, encrypted_state)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, peer_user_id, conversation_id) DO UPDATE SET
                encrypted_state = $4,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(peer_user_id)
        .bind(conversation_id)
        .bind(encrypted_state)
        .fetch_one(&self.pool)
        .await?;
        Ok(session)
    }

    pub async fn get_ratchet_session(
        &self,
        user_id: Uuid,
        peer_user_id: Uuid,
        conversation_id: Uuid,
    ) -> Result<Option<RatchetSession>> {
        let session = sqlx::query_as::<_, RatchetSession>(
            "SELECT * FROM ratchet_sessions WHERE user_id = $1 AND peer_user_id = $2 AND conversation_id = $3",
        )
        .bind(user_id)
        .bind(peer_user_id)
        .bind(conversation_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(session)
    }

    pub async fn create_pending_key_exchange(
        &self,
        from_user_id: Uuid,
        to_user_id: Uuid,
        conversation_id: Uuid,
        key_bundle: Vec<u8>,
    ) -> Result<PendingKeyExchange> {
        let exchange = sqlx::query_as::<_, PendingKeyExchange>(
            r#"
            INSERT INTO pending_key_exchanges (from_user_id, to_user_id, conversation_id, key_bundle)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (from_user_id, to_user_id, conversation_id) DO UPDATE SET
                key_bundle = $4,
                created_at = NOW()
            RETURNING *
            "#,
        )
        .bind(from_user_id)
        .bind(to_user_id)
        .bind(conversation_id)
        .bind(key_bundle)
        .fetch_one(&self.pool)
        .await?;
        Ok(exchange)
    }

    pub async fn get_pending_key_exchanges(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<PendingKeyExchange>> {
        let exchanges = sqlx::query_as::<_, PendingKeyExchange>(
            "SELECT * FROM pending_key_exchanges WHERE to_user_id = $1 ORDER BY created_at ASC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(exchanges)
    }

    pub async fn delete_pending_key_exchange(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM pending_key_exchanges WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
