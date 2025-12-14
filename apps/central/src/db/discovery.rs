use crate::error::Result;
use crate::models::RegisteredServer;

use super::Database;

impl Database {
    pub async fn get_discoverable_servers(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<RegisteredServer>> {
        let servers = sqlx::query_as::<_, RegisteredServer>(
            r#"
            SELECT * FROM registered_servers
            WHERE is_discoverable = true
            ORDER BY member_count DESC, last_heartbeat DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;
        Ok(servers)
    }

    pub async fn search_discoverable_servers(
        &self,
        query: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<RegisteredServer>> {
        let search_pattern = format!("%{}%", query);
        let servers = sqlx::query_as::<_, RegisteredServer>(
            r#"
            SELECT * FROM registered_servers
            WHERE is_discoverable = true
            AND (display_name ILIKE $1 OR description ILIKE $1)
            ORDER BY member_count DESC, last_heartbeat DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(search_pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;
        Ok(servers)
    }

    pub async fn count_discoverable_servers(&self) -> Result<i64> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM registered_servers WHERE is_discoverable = true")
                .fetch_one(&self.pool)
                .await?;
        Ok(count.0)
    }

    pub async fn get_recently_active_servers(&self, limit: i64) -> Result<Vec<RegisteredServer>> {
        let servers = sqlx::query_as::<_, RegisteredServer>(
            r#"
            SELECT * FROM registered_servers
            WHERE is_discoverable = true
            AND last_heartbeat > NOW() - INTERVAL '10 minutes'
            ORDER BY member_count DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(servers)
    }
}
