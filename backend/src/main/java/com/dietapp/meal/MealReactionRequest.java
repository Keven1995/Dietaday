package com.dietapp.meal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MealReactionRequest(@NotBlank @Size(max = 64) String emoji) {}
