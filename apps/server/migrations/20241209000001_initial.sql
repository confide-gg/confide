CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE server_identity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_name TEXT NOT NULL,
    dsa_public_key BYTEA NOT NULL,
    dsa_private_key_encrypted BYTEA NOT NULL,
    setup_token_hash BYTEA,
    central_registration_id UUID,
    owner_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    central_user_id UUID NOT NULL UNIQUE,
    username TEXT NOT NULL,
    kem_public_key BYTEA NOT NULL,
    dsa_public_key BYTEA NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    permissions BIGINT NOT NULL DEFAULT 0,
    color TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member_roles (
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (member_id, role_id)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE text_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES text_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES members(id),
    encrypted_content BYTEA NOT NULL,
    signature BYTEA NOT NULL,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE message_keys (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    encrypted_key BYTEA NOT NULL,
    PRIMARY KEY (message_id, member_id)
);

CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID REFERENCES members(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES members(id) ON DELETE SET NULL,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bans (
    central_user_id UUID PRIMARY KEY,
    banned_by UUID REFERENCES members(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_member_id ON sessions(member_id);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_text_channels_category_id ON text_channels(category_id);
CREATE INDEX idx_member_roles_member_id ON member_roles(member_id);
CREATE INDEX idx_member_roles_role_id ON member_roles(role_id);
