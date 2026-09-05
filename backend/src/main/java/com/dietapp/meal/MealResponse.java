package com.dietapp.meal;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MealResponse(UUID id, String mealType, String description,
                           LocalDate mealDate, String photoUrl,
                           UUID authorId, String authorName, Instant createdAt) {
    static MealResponse from(Meal meal) {
        return new MealResponse(meal.getId(), meal.getMealType(), meal.getDescription(),
                meal.getMealDate(), meal.getPhotoUrl(), meal.getAuthor().getId(),
                meal.getAuthor().getFullName(), meal.getCreatedAt());
    }
}
