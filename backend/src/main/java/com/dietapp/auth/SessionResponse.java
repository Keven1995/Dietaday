package com.dietapp.auth;

import java.time.Instant;
import java.util.UUID;

public record SessionResponse(UUID id, Instant createdAt, Instant lastUsedAt,
                              Instant expiresAt, boolean current) {}
