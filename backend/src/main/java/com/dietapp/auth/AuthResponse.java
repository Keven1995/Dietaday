package com.dietapp.auth;

import java.util.UUID;

public record AuthResponse(String token, UUID userId, String email, String fullName) {
}
