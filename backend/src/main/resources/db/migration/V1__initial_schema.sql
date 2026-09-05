CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    weight_kg DECIMAL(5,2),
    height_cm INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_user_weight CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 500)),
    CONSTRAINT ck_user_height CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 300))
);

CREATE TABLE diets (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_diet_dates CHECK (end_date >= start_date)
);

CREATE TABLE diet_members (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_diet_member UNIQUE (diet_id, user_id),
    CONSTRAINT ck_member_role CHECK (role IN ('OWNER', 'MEMBER'))
);

CREATE INDEX idx_diet_members_user ON diet_members(user_id);

CREATE TABLE meals (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES app_users(id),
    meal_type VARCHAR(30) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    meal_date DATE NOT NULL,
    photo_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_meals_diet_date ON meals(diet_id, meal_date);
CREATE INDEX idx_meals_author ON meals(author_id);
