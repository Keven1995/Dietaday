package com.dietapp.invitation;

import java.time.Instant;

public record CreatedDietInvitationLink(String token, Instant expiresAt) {}
