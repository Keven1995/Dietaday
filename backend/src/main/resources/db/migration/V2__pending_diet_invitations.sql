CREATE TABLE diet_invitations (
    id UUID PRIMARY KEY,
    diet_id UUID NOT NULL REFERENCES diets(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES app_users(id),
    invitee_id UUID NOT NULL REFERENCES app_users(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    pending_marker BOOLEAN,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_invitation_status CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    CONSTRAINT ck_invitation_response CHECK (
        (status = 'PENDING' AND responded_at IS NULL AND pending_marker = TRUE)
        OR (status IN ('ACCEPTED', 'DECLINED') AND responded_at IS NOT NULL AND pending_marker IS NULL)
    ),
    CONSTRAINT ck_invitation_users CHECK (inviter_id <> invitee_id),
    CONSTRAINT uq_pending_diet_invitation UNIQUE (diet_id, invitee_id, pending_marker)
);

CREATE INDEX idx_diet_invitations_invitee_status
    ON diet_invitations(invitee_id, status);
