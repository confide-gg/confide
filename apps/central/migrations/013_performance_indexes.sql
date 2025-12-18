CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_keys_lookup
ON message_keys(message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
ON message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_sessions_token_active
ON sessions(token_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
ON conversation_members(user_id, conversation_id);
