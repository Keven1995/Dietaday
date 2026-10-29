package com.dietapp.meal;

import com.dietapp.diet.DietMealTypeScheduleEntry;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.List;

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

    @Test
    void calculatesGoalsAndStreakUsingTheConfigurationEffectiveOnEachDay() {
        LocalDate firstConfiguredDay = TODAY.minusDays(2);
        LocalDate secondConfigurationDay = TODAY.minusDays(1);
        Map<LocalDate, Set<String>> meals = new HashMap<>();
        meals.put(firstConfiguredDay, new LinkedHashSet<>(Set.of("Café da manhã", "Almoço")));
        meals.put(secondConfigurationDay, new LinkedHashSet<>(Set.of("Almoço")));
        meals.put(TODAY, new LinkedHashSet<>(Set.of("Almoço")));
        List<DietMealTypeScheduleEntry> schedule = List.of(
                new DietMealTypeScheduleEntry(firstConfiguredDay, List.of("Café da manhã", "Almoço")),
                new DietMealTypeScheduleEntry(secondConfigurationDay, List.of("Almoço")));

        DailyMealGoal.Result result = DailyMealGoal.calculate(TODAY, firstConfiguredDay, meals, schedule);

        assertEquals(1, result.completedMeals());
        assertEquals(List.of("Almoço"), result.completedMealTypes());
        assertEquals(List.of("Almoço"), result.mealTypes());
        assertTrue(result.completed());
        assertEquals(3, result.streakDays());
    }

    @Test
    void recognizesApiMealTypeKeysWhenComparingAgainstConfiguredLabels() {
        Map<LocalDate, Set<String>> meals = new HashMap<>();
        DailyMealGoal.addMeal(meals, TODAY, "LUNCH");
        List<DietMealTypeScheduleEntry> schedule = List.of(
                new DietMealTypeScheduleEntry(TODAY, List.of("Almoço")));

        DailyMealGoal.Result result = DailyMealGoal.calculate(TODAY, TODAY, meals, schedule);

        assertEquals(List.of("Almoço"), result.completedMealTypes());
        assertTrue(result.completed());
    }

    @Test
    void removingATypeTomorrowDoesNotRewriteThePreviousDaysGoal() {
        LocalDate previousDay = TODAY.minusDays(1);
        Map<LocalDate, Set<String>> meals = new HashMap<>();
        meals.put(previousDay, new LinkedHashSet<>(Set.of("Almoço")));
        meals.put(TODAY, new LinkedHashSet<>(Set.of("Almoço")));
        List<DietMealTypeScheduleEntry> schedule = List.of(
                new DietMealTypeScheduleEntry(previousDay, List.of("Café da manhã", "Almoço")),
                new DietMealTypeScheduleEntry(TODAY, List.of("Almoço")));

        DailyMealGoal.Result result = DailyMealGoal.calculate(TODAY, previousDay, meals, schedule);

        assertEquals(1, result.mealTypes().size());
        assertEquals(1, result.streakDays());
        assertTrue(result.completed());
    }
}
