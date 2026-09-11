CREATE TABLE meal_plans (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
    source_text VARCHAR(20000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE meal_plan_items (
    id UUID PRIMARY KEY,
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    display_order INTEGER,
    meal_type VARCHAR(30) NOT NULL,
    planned_description VARCHAR(1000) NOT NULL,
    CONSTRAINT uq_meal_plan_item_type UNIQUE (meal_plan_id, meal_type)
);
