CREATE TABLE heartbeat_nonces (
    nonce UUID PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES registered_servers(id) ON DELETE CASCADE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_heartbeat_nonces_server_id ON heartbeat_nonces(server_id);
CREATE INDEX idx_heartbeat_nonces_received_at ON heartbeat_nonces(received_at);

COMMENT ON TABLE heartbeat_nonces IS 'Stores nonces from server heartbeats to prevent replay attacks. Nonces are kept for 10 minutes.';
