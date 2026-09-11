package com.dietapp.meal;

import java.util.UUID;

public record MealReactionCount(UUID mealId, String emoji, long count, long currentUserCount) {}
