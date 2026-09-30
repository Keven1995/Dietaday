CREATE TABLE ux_events (
    id UUID PRIMARY KEY,
    event_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    details VARCHAR(2000) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_ux_events_user_event UNIQUE (user_id, event_id)
);

CREATE INDEX idx_ux_events_diet_time
    ON ux_events(diet_id, occurred_at DESC);

CREATE INDEX idx_ux_events_name_time
    ON ux_events(event_name, occurred_at DESC);
