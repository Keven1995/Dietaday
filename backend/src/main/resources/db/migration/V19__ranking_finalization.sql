CREATE TABLE ranking_finalizations (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    finalized_at TIMESTAMP WITH TIME ZONE NOT NULL,
    first_user_id UUID REFERENCES app_users(id),
    second_user_id UUID REFERENCES app_users(id),
    third_user_id UUID REFERENCES app_users(id),
    CONSTRAINT uq_ranking_finalization_diet UNIQUE (diet_id)
);
