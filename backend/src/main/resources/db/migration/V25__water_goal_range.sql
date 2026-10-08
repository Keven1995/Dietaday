UPDATE app_users
SET daily_water_goal_ml = 2000
WHERE daily_water_goal_ml < 2000;

ALTER TABLE app_users
    DROP CONSTRAINT ck_user_daily_water_goal;

ALTER TABLE app_users
    ADD CONSTRAINT ck_user_daily_water_goal
    CHECK (daily_water_goal_ml BETWEEN 2000 AND 4000 AND MOD(daily_water_goal_ml, 50) = 0);
