ALTER TABLE app_users
    ADD COLUMN daily_water_goal_ml INTEGER NOT NULL DEFAULT 2000;

ALTER TABLE app_users
    ADD CONSTRAINT ck_user_daily_water_goal CHECK (daily_water_goal_ml BETWEEN 500 AND 4000 AND MOD(daily_water_goal_ml, 500) = 0);

CREATE TABLE water_checks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    amount_ml INTEGER NOT NULL,
    check_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_water_check_amount CHECK (amount_ml BETWEEN 500 AND 4000 AND MOD(amount_ml, 500) = 0)
);

CREATE INDEX idx_water_checks_user_date ON water_checks(user_id, check_date, created_at);
