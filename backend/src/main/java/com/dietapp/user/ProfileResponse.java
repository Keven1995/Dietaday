package com.dietapp.user;

import java.math.BigDecimal;
import java.util.UUID;

public record ProfileResponse(UUID id, String email, String fullName,
                              BigDecimal weightKg, Integer heightCm) {
    static ProfileResponse from(User user) {
        return new ProfileResponse(user.getId(), user.getEmail(), user.getFullName(),
                user.getWeightKg(), user.getHeightCm());
    }
}
