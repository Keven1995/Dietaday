CREATE TABLE ranking_scores (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    active_days INTEGER NOT NULL,
    first_reached_at TIMESTAMP WITH TIME ZONE,
    initial_order BIGINT NOT NULL,
    CONSTRAINT uq_ranking_score_diet_user UNIQUE (diet_id, user_id),
    CONSTRAINT ck_ranking_score_points CHECK (points >= 0),
    CONSTRAINT ck_ranking_score_active_days CHECK (active_days >= 0)
);

CREATE TABLE ranking_daily_positions (
    id UUID PRIMARY KEY,
    closure_id UUID NOT NULL REFERENCES ranking_daily_closures(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    points INTEGER NOT NULL,
    active_days INTEGER NOT NULL,
    first_reached_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_ranking_daily_position_participant UNIQUE (closure_id, user_id),
    CONSTRAINT uq_ranking_daily_position_number UNIQUE (closure_id, position),
    CONSTRAINT ck_ranking_daily_position_position CHECK (position > 0),
    CONSTRAINT ck_ranking_daily_position_points CHECK (points >= 0),
    CONSTRAINT ck_ranking_daily_position_active_days CHECK (active_days >= 0)
);

CREATE INDEX idx_ranking_scores_diet ON ranking_scores(diet_id);
CREATE INDEX idx_ranking_daily_positions_closure ON ranking_daily_positions(closure_id, position);
