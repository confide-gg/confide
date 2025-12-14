ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN call_id UUID REFERENCES calls(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN call_duration_seconds INTEGER;

CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_call_id ON messages(call_id);
