ALTER TABLE members ADD COLUMN encrypted_channel_keys JSONB NOT NULL DEFAULT '{}';

ALTER TABLE text_channels ADD COLUMN channel_key_version INTEGER NOT NULL DEFAULT 1;

DROP TABLE IF EXISTS message_keys;
