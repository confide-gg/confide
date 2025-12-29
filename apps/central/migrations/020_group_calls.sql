ALTER TABLE calls ADD COLUMN call_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (call_type IN ('direct', 'group'));

ALTER TABLE calls ADD COLUMN initiator_id UUID REFERENCES users(id);

ALTER TABLE calls ALTER COLUMN caller_id DROP NOT NULL;
ALTER TABLE calls ALTER COLUMN callee_id DROP NOT NULL;

ALTER TABLE calls DROP CONSTRAINT calls_no_self_call;
ALTER TABLE calls ADD CONSTRAINT calls_no_self_call
    CHECK (call_type = 'group' OR caller_id != callee_id);

ALTER TABLE calls ADD CONSTRAINT calls_direct_requires_caller_callee
    CHECK (call_type = 'group' OR (caller_id IS NOT NULL AND callee_id IS NOT NULL));

ALTER TABLE calls ADD CONSTRAINT calls_group_requires_initiator
    CHECK (call_type = 'direct' OR initiator_id IS NOT NULL);

CREATE TABLE group_call_participants (
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'ringing', 'connecting', 'active', 'left', 'declined')),
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_deafened BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    encrypted_sender_key BYTEA,
    sender_key_version INTEGER DEFAULT 1,
    PRIMARY KEY (call_id, user_id)
);

CREATE INDEX idx_group_call_participants_user ON group_call_participants(user_id);
CREATE INDEX idx_group_call_participants_active ON group_call_participants(call_id)
    WHERE status IN ('ringing', 'connecting', 'active');

CREATE INDEX idx_calls_group_active ON calls(conversation_id)
    WHERE call_type = 'group' AND status IN ('pending', 'ringing', 'connecting', 'active');
