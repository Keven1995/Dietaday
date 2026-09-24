CREATE TABLE sync_error_events (
    id UUID PRIMARY KEY,
    operation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    phase VARCHAR(32) NOT NULL,
    attempt INTEGER NOT NULL,
    duration_ms BIGINT,
    http_status INTEGER,
    error_code VARCHAR(64) NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_sync_error_events_occurred_at
    ON sync_error_events(occurred_at DESC);

CREATE INDEX idx_sync_error_events_operation
    ON sync_error_events(operation_id, occurred_at DESC);

CREATE INDEX idx_sync_error_events_user
    ON sync_error_events(user_id, occurred_at DESC);

CREATE INDEX idx_sync_error_events_diet
    ON sync_error_events(diet_id, occurred_at DESC);
