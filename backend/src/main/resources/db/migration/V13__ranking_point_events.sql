CREATE TABLE ranking_point_events (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    source_type VARCHAR(40) NOT NULL,
    source_id UUID NOT NULL,
    meal_type VARCHAR(30),
    points INTEGER NOT NULL,
    event_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_ranking_point_event_source CHECK (source_type IN ('MEAL', 'WATER_CHECK')),
    CONSTRAINT ck_ranking_point_event_status CHECK (status IN ('PENDING', 'SETTLED', 'REVOKED')),
    CONSTRAINT ck_ranking_point_event_points CHECK (points > 0),
    CONSTRAINT uq_ranking_point_event_source UNIQUE (source_type, source_id)
);

CREATE UNIQUE INDEX uq_ranking_meal_type_day
    ON ranking_point_events(diet_id, user_id, event_date, meal_type, source_type, status);

CREATE INDEX idx_ranking_point_events_diet_date
    ON ranking_point_events(diet_id, event_date, status);
