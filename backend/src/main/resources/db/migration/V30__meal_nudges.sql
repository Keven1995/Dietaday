ALTER TABLE app_users
    ADD COLUMN receive_meal_nudges BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE meal_nudges (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    meal_type VARCHAR(32) NOT NULL,
    meal_date DATE NOT NULL,
    message_key VARCHAR(40) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_meal_nudge_type CHECK (meal_type IN (
        'BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'SUPPER'
    )),
    CONSTRAINT ck_meal_nudge_message CHECK (message_key IN (
        'WHERE_IS_BREAKFAST', 'WHERE_IS_MORNING_SNACK', 'WHERE_IS_LUNCH',
        'WHERE_IS_AFTERNOON_SNACK', 'WHERE_IS_DINNER', 'WHERE_IS_SUPPER'
    )),
    CONSTRAINT ck_meal_nudge_different_users CHECK (sender_id <> recipient_id),
    CONSTRAINT uq_meal_nudge_daily UNIQUE (diet_id, sender_id, recipient_id, meal_date, meal_type)
);

CREATE INDEX idx_meal_nudges_recipient_created
    ON meal_nudges(recipient_id, created_at DESC, id DESC);
CREATE INDEX idx_meal_nudges_diet_recipient_date
    ON meal_nudges(diet_id, recipient_id, meal_date);
