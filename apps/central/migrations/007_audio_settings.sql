CREATE TABLE IF NOT EXISTS user_audio_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    input_volume REAL NOT NULL DEFAULT 1.0,
    output_volume REAL NOT NULL DEFAULT 1.0,
    input_sensitivity REAL NOT NULL DEFAULT 0.3,
    voice_activity_enabled BOOLEAN NOT NULL DEFAULT false,
    push_to_talk_enabled BOOLEAN NOT NULL DEFAULT false,
    push_to_talk_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
