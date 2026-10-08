ALTER TABLE app_users
    ADD COLUMN water_goal_suggestion_review_status VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED';

ALTER TABLE app_users
    ADD CONSTRAINT ck_user_water_goal_suggestion_review_status
    CHECK (water_goal_suggestion_review_status IN ('NOT_REQUIRED', 'PENDING', 'RESOLVED'));
