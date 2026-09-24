ALTER TABLE ranking_point_events
    ADD CONSTRAINT fk_ranking_point_event_membership
    FOREIGN KEY (diet_id, user_id)
    REFERENCES diet_members(diet_id, user_id);
