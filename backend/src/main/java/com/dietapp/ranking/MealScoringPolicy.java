package com.dietapp.ranking;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.meal.Meal;

import java.time.LocalDate;
import java.util.Set;

public final class MealScoringPolicy {
    public static final int POINTS = 5;
    private static final Set<String> TYPES = Set.of(
            "Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia");

    private MealScoringPolicy() {}

    public static void validate(Diet diet, Meal meal, LocalDate today, boolean duplicate) {
        if (!diet.isCompetitiveMode()) return;
        if (today.isBefore(diet.getStartDate()) || today.isAfter(diet.getEndDate())) {
            throw new ConflictException("The competitive diet is outside its active period");
        }
        if (!TYPES.contains(meal.getMealType())) {
            throw new BadRequestException("Invalid meal type for competitive scoring");
        }
        if (meal.getMealDate().isBefore(diet.getStartDate()) || meal.getMealDate().isAfter(diet.getEndDate())) {
            throw new BadRequestException("Meal date must be within the diet period");
        }
        if (duplicate) throw new ConflictException("This meal type has already scored today");
    }

    public static boolean isOfficialType(String type) { return TYPES.contains(type); }
}
