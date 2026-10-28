package com.dietapp.security;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "login_attempt_states")
public class LoginAttemptState {
    @Id
    @Column(name = "attempt_key_hash", nullable = false, length = 64)
    private String attemptKeyHash;

    @Column(name = "window_started_at", nullable = false)
    private Instant windowStartedAt;

    @Column(name = "failure_count", nullable = false)
    private int failureCount;

    @Column(name = "in_flight_count", nullable = false)
    private int inFlightCount;

    @Column(name = "blocked_until")
    private Instant blockedUntil;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected LoginAttemptState() {}

    public LoginAttemptState(String attemptKeyHash, Instant now) {
        this.attemptKeyHash = attemptKeyHash;
        this.windowStartedAt = now;
        this.updatedAt = now;
    }
}
