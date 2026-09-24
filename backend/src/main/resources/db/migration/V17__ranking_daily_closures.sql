CREATE TABLE ranking_daily_closures (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_ranking_daily_closure_diet_date UNIQUE (diet_id, event_date)
);

CREATE TABLE ranking_daily_totals (
    id UUID PRIMARY KEY,
    closure_id UUID NOT NULL REFERENCES ranking_daily_closures(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    meal_count INTEGER NOT NULL,
    water_check_count INTEGER NOT NULL,
    points INTEGER NOT NULL,
    CONSTRAINT uq_ranking_daily_total_participant UNIQUE (closure_id, user_id),
    CONSTRAINT ck_ranking_daily_total_meals CHECK (meal_count >= 0),
    CONSTRAINT ck_ranking_daily_total_water CHECK (water_check_count >= 0),
    CONSTRAINT ck_ranking_daily_total_points CHECK (points >= 0)
);

CREATE INDEX idx_ranking_daily_closures_diet_date
    ON ranking_daily_closures(diet_id, event_date);

CREATE INDEX idx_ranking_daily_totals_user
    ON ranking_daily_totals(user_id, closure_id);
