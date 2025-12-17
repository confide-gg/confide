CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_channel_created
ON messages(channel_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_id
ON messages(sender_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_roles_lookup
ON member_roles(member_id, role_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active_token
ON sessions(token_hash) WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_at
ON sessions(expires_at);
