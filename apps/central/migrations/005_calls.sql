CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'ringing', 'connecting', 'active', 
                          'ended', 'missed', 'rejected', 'cancelled')),
    
    caller_ephemeral_public BYTEA,
    callee_ephemeral_public BYTEA,
    
    relay_token_hash BYTEA,
    relay_token_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ring_started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    end_reason TEXT CHECK (end_reason IN ('normal', 'timeout', 'network_error', 
                                          'declined', 'busy', 'cancelled', 'failed')),
    duration_seconds INTEGER,
    
    CONSTRAINT calls_no_self_call CHECK (caller_id != callee_id)
);

CREATE INDEX idx_calls_caller ON calls(caller_id, created_at DESC);
CREATE INDEX idx_calls_callee ON calls(callee_id, created_at DESC);
CREATE INDEX idx_calls_caller_active ON calls(caller_id) 
    WHERE status IN ('pending', 'ringing', 'connecting', 'active');
CREATE INDEX idx_calls_callee_active ON calls(callee_id) 
    WHERE status IN ('pending', 'ringing', 'connecting', 'active');
CREATE INDEX idx_calls_conversation ON calls(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_calls_ended_at ON calls(ended_at) WHERE ended_at IS NOT NULL;
