package com.dietapp.meal;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DailyMealGoalTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 29);

    @Test
    void completesOnlyWhenAllSixOfficialMealsExist() {
        Map<LocalDate, Set<String>> meals = new HashMap<>();
        meals.put(TODAY, new LinkedHashSet<>(DailyMealGoal.TYPES));

        DailyMealGoal.Result result = DailyMealGoal.calculate(TODAY, TODAY.minusDays(4), meals);

        assertEquals(6, result.completedMeals());
        assertEquals(DailyMealGoal.TYPES, result.completedMealTypes());
        assertTrue(result.completed());
        assertEquals(1, result.streakDays());
    }

    @Test
    void countsConsecutiveCompletedDaysAndKeepsAnIncompleteTodayFromBreakingYesterday() {
        Map<LocalDate, Set<String>> meals = new HashMap<>();
        meals.put(TODAY.minusDays(2), new LinkedHashSet<>(DailyMealGoal.TYPES));
        meals.put(TODAY.minusDays(1), new LinkedHashSet<>(DailyMealGoal.TYPES));
        meals.put(TODAY, new LinkedHashSet<>(Set.of("Café da manhã")));

        DailyMealGoal.Result result = DailyMealGoal.calculate(TODAY, TODAY.minusDays(4), meals);

        assertFalse(result.completed());
        assertEquals(1, result.completedMeals());
        assertEquals(2, result.streakDays());
    }
}
