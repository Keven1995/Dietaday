package com.dietapp.ranking;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.meal.Meal;

import java.time.LocalDate;

public final class MealScoringPolicy {
    public static final int POINTS = 5;
    private MealScoringPolicy() {}

    public static void validate(Diet diet, Meal meal, LocalDate today, boolean duplicate) {
        if (!diet.isCompetitiveMode()) return;
        CompetitivePeriodPolicy.validateWriteToday(diet, today);
        if (!CompetitiveMealType.matchesLabel(meal.getMealType())) {
            throw new BadRequestException("Invalid meal type for competitive scoring");
        }
        CompetitivePeriodPolicy.validateEventDate(diet, meal.getMealDate());
        if (duplicate) throw new ConflictException("This meal type has already scored today");
    }

    public static boolean isOfficialType(String type) { return CompetitiveMealType.matchesLabel(type); }
}
