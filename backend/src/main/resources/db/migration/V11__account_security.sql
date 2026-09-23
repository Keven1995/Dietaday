ALTER TABLE app_users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE refresh_tokens
    ADD COLUMN user_agent VARCHAR(255);

ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(64);
ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE account_action_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    token_type VARCHAR(32) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_account_action_token_type CHECK (token_type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET'))
);

CREATE INDEX idx_account_action_tokens_user ON account_action_tokens(user_id);
CREATE INDEX idx_account_action_tokens_expiry ON account_action_tokens(expires_at);
