CREATE TABLE channel_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES text_channels(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    allow_permissions BIGINT NOT NULL DEFAULT 0,
    deny_permissions BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channel_permission_overrides_target_check CHECK ((role_id IS NOT NULL AND member_id IS NULL) OR (role_id IS NULL AND member_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_channel_permission_overrides_role_unique
    ON channel_permission_overrides(channel_id, role_id) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_permission_overrides_member_unique
    ON channel_permission_overrides(channel_id, member_id) WHERE member_id IS NOT NULL;

CREATE INDEX idx_channel_permission_overrides_channel ON channel_permission_overrides(channel_id);
CREATE INDEX idx_channel_permission_overrides_role ON channel_permission_overrides(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX idx_channel_permission_overrides_member ON channel_permission_overrides(member_id) WHERE member_id IS NOT NULL;

CREATE TABLE member_channel_keys (
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES text_channels(id) ON DELETE CASCADE,
    encrypted_key BYTEA NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (member_id, channel_id)
);

CREATE INDEX idx_member_channel_keys_member ON member_channel_keys(member_id);
CREATE INDEX idx_member_channel_keys_channel ON member_channel_keys(channel_id);

ALTER TABLE members DROP COLUMN IF EXISTS encrypted_channel_keys;

ALTER TABLE text_channels DROP COLUMN IF EXISTS channel_key_version;
