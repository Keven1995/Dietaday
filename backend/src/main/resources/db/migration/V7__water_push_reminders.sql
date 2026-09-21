CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    endpoint VARCHAR(2048) NOT NULL UNIQUE,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_push_subscriptions_user_enabled ON push_subscriptions(user_id, enabled);

CREATE TABLE water_reminder_deliveries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL,
    reminder_slot VARCHAR(5) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_water_reminder_delivery UNIQUE (user_id, reminder_date, reminder_slot)
);

CREATE INDEX idx_water_reminder_delivery_date ON water_reminder_deliveries(reminder_date, reminder_slot);
