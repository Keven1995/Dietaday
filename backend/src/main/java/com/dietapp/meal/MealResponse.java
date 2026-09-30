package com.dietapp.meal;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record MealResponse(UUID id, String mealType, String description,
                           LocalDate mealDate, String photoUrl,
                           UUID authorId, String authorName, Instant createdAt,
                           List<MealReactionSummary> reactions, long commentCount,
                           int pointsEarned) {
    public MealResponse(UUID id, String mealType, String description,
                        LocalDate mealDate, String photoUrl,
                        UUID authorId, String authorName, Instant createdAt,
                        List<MealReactionSummary> reactions, long commentCount) {
        this(id, mealType, description, mealDate, photoUrl, authorId, authorName,
                createdAt, reactions, commentCount, 0);
    }

    static MealResponse from(Meal meal, List<MealReactionSummary> reactions, long commentCount) {
        return from(meal, reactions, commentCount, 0);
    }

    static MealResponse from(Meal meal, List<MealReactionSummary> reactions, long commentCount, int pointsEarned) {
        return new MealResponse(meal.getId(), meal.getMealType(), meal.getDescription(),
                meal.getMealDate(), meal.getPhotoUrl(), meal.getAuthor().getId(),
                meal.getAuthor().getFullName(), meal.getCreatedAt(), reactions, commentCount, pointsEarned);
    }
}
