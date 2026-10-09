package com.dietapp.nudge;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record MealNudgeMemberEligibilityResponse(UUID recipientId, String recipientName,
                                                LocalDate mealDate,
                                                List<MealNudgeEligibilityResponse.MealEligibility> meals) {}
