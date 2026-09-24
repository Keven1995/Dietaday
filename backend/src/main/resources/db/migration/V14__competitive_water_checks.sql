ALTER TABLE water_checks ADD COLUMN diet_id UUID REFERENCES diets(id) ON DELETE CASCADE;

CREATE INDEX idx_water_checks_diet_user_date
    ON water_checks(diet_id, user_id, check_date, created_at);
