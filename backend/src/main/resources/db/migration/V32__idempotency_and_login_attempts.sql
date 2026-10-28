ALTER TABLE diets ADD COLUMN creation_operation_id UUID;
ALTER TABLE diets ADD COLUMN creation_request_hash VARCHAR(64);

ALTER TABLE diets
    ADD CONSTRAINT ck_diet_creation_idempotency_pair CHECK (
        (creation_operation_id IS NULL AND creation_request_hash IS NULL)
        OR (creation_operation_id IS NOT NULL AND creation_request_hash IS NOT NULL)
    );

CREATE UNIQUE INDEX uq_diets_creation_operation
    ON diets (creation_operation_id);

ALTER TABLE water_checks ADD COLUMN operation_id UUID;
ALTER TABLE water_checks ADD COLUMN request_hash VARCHAR(64);

ALTER TABLE water_checks
    ADD CONSTRAINT ck_water_check_idempotency_pair CHECK (
        (operation_id IS NULL AND request_hash IS NULL)
        OR (operation_id IS NOT NULL AND request_hash IS NOT NULL)
    );

CREATE UNIQUE INDEX uq_water_checks_operation
    ON water_checks (operation_id);

ALTER TABLE meal_comments ADD COLUMN operation_id UUID;
ALTER TABLE meal_comments ADD COLUMN request_hash VARCHAR(64);

ALTER TABLE meal_comments
    ADD CONSTRAINT ck_meal_comment_idempotency_pair CHECK (
        (operation_id IS NULL AND request_hash IS NULL)
        OR (operation_id IS NOT NULL AND request_hash IS NOT NULL)
    );

CREATE UNIQUE INDEX uq_meal_comments_operation
    ON meal_comments (operation_id);

CREATE UNIQUE INDEX uq_sync_error_operation_phase_attempt
    ON sync_error_events (operation_id, phase, attempt);

CREATE TABLE login_attempt_states (
    attempt_key_hash VARCHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0,
    in_flight_count INTEGER NOT NULL DEFAULT 0,
    blocked_until TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_login_attempt_failure_count CHECK (failure_count >= 0),
    CONSTRAINT ck_login_attempt_in_flight_count CHECK (in_flight_count >= 0)
);

CREATE INDEX idx_login_attempt_states_updated_at
    ON login_attempt_states (updated_at);
