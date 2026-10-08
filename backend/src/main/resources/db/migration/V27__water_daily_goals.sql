CREATE TABLE water_daily_goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    diet_id UUID REFERENCES diets(id) ON DELETE CASCADE,
    scope_key UUID NOT NULL,
    goal_date DATE NOT NULL,
    goal_ml INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_water_daily_goal_scope CHECK (
        (diet_id IS NULL AND scope_key = CAST('00000000-0000-0000-0000-000000000000' AS UUID))
        OR (diet_id IS NOT NULL AND diet_id <> CAST('00000000-0000-0000-0000-000000000000' AS UUID) AND scope_key = diet_id)
    ),
    CONSTRAINT ck_water_daily_goal_amount
        CHECK (goal_ml BETWEEN 2000 AND 4000 AND MOD(goal_ml, 50) = 0),
    CONSTRAINT uq_water_daily_goal_user_scope_date UNIQUE (user_id, scope_key, goal_date)
);

CREATE INDEX idx_water_daily_goals_user_date
    ON water_daily_goals(user_id, goal_date);

CREATE INDEX idx_water_daily_goals_diet_user_date
    ON water_daily_goals(diet_id, user_id, goal_date);
