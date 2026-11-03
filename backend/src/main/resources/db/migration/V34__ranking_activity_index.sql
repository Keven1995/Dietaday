CREATE INDEX IF NOT EXISTS idx_ranking_point_events_diet_created
    ON ranking_point_events (diet_id, created_at);
