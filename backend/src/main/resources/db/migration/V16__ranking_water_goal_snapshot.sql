ALTER TABLE ranking_point_events
    ADD COLUMN water_goal_ml INTEGER;

ALTER TABLE ranking_point_events
    ADD CONSTRAINT ck_ranking_water_goal
    CHECK (source_type <> 'WATER_CHECK' OR water_goal_ml IS NOT NULL);
