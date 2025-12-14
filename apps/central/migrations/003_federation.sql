CREATE TABLE IF NOT EXISTS registered_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dsa_public_key BYTEA NOT NULL UNIQUE,
    domain TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_discoverable BOOLEAN NOT NULL DEFAULT FALSE,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS federation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES registered_servers(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, server_id)
);

CREATE INDEX idx_registered_servers_domain ON registered_servers(domain);
CREATE INDEX idx_registered_servers_owner ON registered_servers(owner_id);
CREATE INDEX idx_registered_servers_discoverable ON registered_servers(is_discoverable) WHERE is_discoverable = TRUE;
CREATE INDEX idx_federation_tokens_server ON federation_tokens(server_id);
CREATE INDEX idx_federation_tokens_expires ON federation_tokens(expires_at);
