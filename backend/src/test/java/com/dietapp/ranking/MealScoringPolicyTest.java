package com.dietapp.ranking;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.meal.Meal;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MealScoringPolicyTest {
    @Test
    void acceptsExactlyTheSixOfficialMealLabels() {
        for (CompetitiveMealType type : CompetitiveMealType.values()) {
            assertTrue(MealScoringPolicy.isOfficialType(type.label()));
        }
        assertFalse(MealScoringPolicy.isOfficialType("LUNCH"));
        assertFalse(MealScoringPolicy.isOfficialType("Brunch"));
    }

    @Test
    void rejectsUnknownTypeForCompetitiveScoring() {
        LocalDate today = LocalDate.now();
        Diet diet = new Diet("Competitive", today.minusDays(1), today.plusDays(1), true);
        User user = new User("policy@example.com", "hash", "Policy User", UserSex.FEMALE);
        Meal meal = new Meal(diet, user, "Brunch", "Meal", today, null);

        assertThrows(BadRequestException.class, () ->
                MealScoringPolicy.validate(diet, meal, today, false));
    }

    @Test
    void blocksWritesOutsideTheCompetitivePeriod() {
        LocalDate today = LocalDate.now();
        Diet diet = new Diet("Competitive", today.minusDays(3), today.minusDays(1), true);

        assertThrows(ConflictException.class, () ->
                CompetitivePeriodPolicy.validateWriteToday(diet, today));
        assertThrows(BadRequestException.class, () ->
                CompetitivePeriodPolicy.validateEventDate(diet, today));
    }
}
