CREATE INDEX IF NOT EXISTS idx_messages_channel_created
ON messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_sessions_active_token
ON sessions(token_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
ON sessions(expires_at);
