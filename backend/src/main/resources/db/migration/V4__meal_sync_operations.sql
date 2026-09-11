CREATE TABLE meal_sync_operations (
    operation_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    meal_id UUID NOT NULL UNIQUE REFERENCES meals(id) ON DELETE CASCADE,
    request_hash VARCHAR(64) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_meal_sync_operations_user
    ON meal_sync_operations(user_id, processed_at DESC);
