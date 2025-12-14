ALTER TABLE calls ADD COLUMN caller_left_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN callee_left_at TIMESTAMPTZ;

CREATE INDEX idx_calls_rejoinable ON calls(id)
    WHERE status = 'active' AND (caller_left_at IS NOT NULL OR callee_left_at IS NOT NULL);
