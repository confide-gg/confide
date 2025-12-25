CREATE INDEX IF NOT EXISTS idx_messages_channel_created
ON messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_member_roles_lookup
ON member_roles(member_id, role_id);

CREATE INDEX IF NOT EXISTS idx_sessions_active_token
ON sessions(token_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_members_central_user_id
ON members(central_user_id);

CREATE INDEX IF NOT EXISTS idx_bans_central_user_id
ON bans(central_user_id);

CREATE INDEX IF NOT EXISTS idx_invites_code
ON invites(code);

CREATE INDEX IF NOT EXISTS idx_invites_channel_id
ON invites(channel_id);
