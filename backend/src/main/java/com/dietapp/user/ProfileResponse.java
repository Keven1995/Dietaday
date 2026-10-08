package com.dietapp.user;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ProfileResponse(UUID id, String email, String fullName,
                              BigDecimal weightKg, Integer heightCm, UserSex sex,
                              boolean emailVerified, LocalDate birthDate,
                              WaterGoalSuggestionReviewResponse waterGoalSuggestionReview) {
    static ProfileResponse from(User user, WaterGoalSuggestionReviewResponse waterGoalSuggestionReview) {
        return new ProfileResponse(user.getId(), user.getEmail(), user.getFullName(),
                user.getWeightKg(), user.getHeightCm(), user.getSex(), user.isEmailVerified(),
                user.getBirthDate(), waterGoalSuggestionReview);
    }
}
