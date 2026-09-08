CREATE INDEX IF NOT EXISTS idx_meals_diet_history
    ON meals (diet_id, meal_date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invitations_pending_history
    ON diet_invitations (invitee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invitations_diet
    ON diet_invitations (diet_id);
