package com.dietapp.auth;

import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account_action_tokens")
public class AccountActionToken {
    public enum Type { EMAIL_VERIFICATION, PASSWORD_RESET }

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Enumerated(EnumType.STRING)
    @Column(name = "token_type", nullable = false, length = 32)
    private Type type;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "used_at")
    private Instant usedAt;

    protected AccountActionToken() {}

    public AccountActionToken(User user, Type type, String tokenHash, Instant expiresAt) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.type = type;
        this.tokenHash = tokenHash;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }

    public User getUser() { return user; }
    public boolean isActive(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }
    public void use() { this.usedAt = Instant.now(); }
}
