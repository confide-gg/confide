CREATE TABLE IF NOT EXISTS user_activities (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('playing', 'listening', 'watching', 'streaming', 'custom')),
    name TEXT,
    details TEXT,
    state TEXT,
    start_timestamp BIGINT,
    end_timestamp BIGINT,
    large_image_url TEXT,
    small_image_url TEXT,
    large_image_text TEXT,
    small_image_text TEXT,
    metadata JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spotify_integrations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    display_in_profile BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_integrations_user_id ON spotify_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_integrations_token_expires_at ON spotify_integrations(token_expires_at);
