package com.dietapp.nudge;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record MealNudgeRequest(@NotNull UUID recipientId, @NotBlank String mealType) {}
