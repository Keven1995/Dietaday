CREATE TABLE diet_invitation_links (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES app_users(id),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    active_marker BOOLEAN,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_diet_invitation_link_active_marker CHECK (
        (revoked_at IS NULL AND active_marker = TRUE)
        OR (revoked_at IS NOT NULL AND active_marker IS NULL)
    ),
    CONSTRAINT uq_active_diet_invitation_link UNIQUE (diet_id, active_marker)
);

CREATE INDEX idx_diet_invitation_links_expiry ON diet_invitation_links(expires_at);
