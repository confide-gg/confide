CREATE TABLE IF NOT EXISTS file_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    s3_key TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    encrypted_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation ON file_attachments(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploader ON file_attachments(uploader_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_expires ON file_attachments(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_with_attachments ON messages(conversation_id, created_at DESC) WHERE has_attachment = TRUE;
