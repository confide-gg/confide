CREATE TABLE IF NOT EXISTS user_servers (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_servers BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
