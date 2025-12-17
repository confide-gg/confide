ALTER TABLE conversations
ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON conversations(owner_id);

CREATE TABLE IF NOT EXISTS group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_events_conversation_id_created_at
ON group_events(conversation_id, created_at);

