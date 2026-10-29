CREATE TABLE diet_meal_type_settings (
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    meal_type VARCHAR(30) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by UUID NOT NULL REFERENCES app_users(id),
    CONSTRAINT pk_diet_meal_type_settings PRIMARY KEY (diet_id, effective_from, meal_type),
    CONSTRAINT ck_diet_meal_type_settings_type CHECK (meal_type IN (
        'Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'
    ))
);

CREATE INDEX idx_diet_meal_type_settings_effective
    ON diet_meal_type_settings(diet_id, effective_from);

INSERT INTO diet_meal_type_settings (diet_id, effective_from, meal_type, updated_at, updated_by)
SELECT d.id, d.start_date, 'Café da manhã', CURRENT_TIMESTAMP, m.user_id
FROM diets d JOIN diet_members m ON m.diet_id = d.id AND m.role = 'OWNER';

INSERT INTO diet_meal_type_settings (diet_id, effective_from, meal_type, updated_at, updated_by)
SELECT d.id, d.start_date, 'Lanche da manhã', CURRENT_TIMESTAMP, m.user_id
FROM diets d JOIN diet_members m ON m.diet_id = d.id AND m.role = 'OWNER';

INSERT INTO diet_meal_type_settings (diet_id, effective_from, meal_type, updated_at, updated_by)
SELECT d.id, d.start_date, 'Almoço', CURRENT_TIMESTAMP, m.user_id
FROM diets d JOIN diet_members m ON m.diet_id = d.id AND m.role = 'OWNER';

INSERT INTO diet_meal_type_settings (diet_id, effective_from, meal_type, updated_at, updated_by)
SELECT d.id, d.start_date, 'Lanche da tarde', CURRENT_TIMESTAMP, m.user_id
FROM diets d JOIN diet_members m ON m.diet_id = d.id AND m.role = 'OWNER';

INSERT INTO diet_meal_type_settings (diet_id, effective_from, meal_type, updated_at, updated_by)
SELECT d.id, d.start_date, 'Jantar', CURRENT_TIMESTAMP, m.user_id
FROM diets d JOIN diet_members m ON m.diet_id = d.id AND m.role = 'OWNER';

INSERT INTO diet_meal_type_settings (diet_id, effective_from, meal_type, updated_at, updated_by)
SELECT d.id, d.start_date, 'Ceia', CURRENT_TIMESTAMP, m.user_id
FROM diets d JOIN diet_members m ON m.diet_id = d.id AND m.role = 'OWNER';
