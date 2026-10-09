package com.dietapp.nudge;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record MealNudgeEligibilityResponse(UUID recipientId, LocalDate mealDate, List<MealEligibility> meals) {
    public record MealEligibility(String mealType, String mealLabel, String buttonLabel,
                                  boolean eligible, boolean alreadySentByMe, String reason) {}
}
