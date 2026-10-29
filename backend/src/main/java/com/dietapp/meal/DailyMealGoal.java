package com.dietapp.meal;

import com.dietapp.diet.DietMealTypeScheduleEntry;
import com.dietapp.diet.DietMealTypeService;

import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DailyMealGoal {
    public static final List<String> TYPES = DietMealTypeService.DEFAULT_MEAL_TYPES;
    public static final int TARGET = TYPES.size();
    private static final Set<String> TYPE_SET = Set.copyOf(TYPES);

    private DailyMealGoal() {}

    public static Result calculate(LocalDate date, LocalDate startDate,
                                   Map<LocalDate, Set<String>> mealsByDate) {
        return calculate(date, startDate, mealsByDate,
                List.of(new DietMealTypeScheduleEntry(startDate, TYPES)));
    }

    public static Result calculate(LocalDate date, LocalDate startDate,
                                   Map<LocalDate, Set<String>> mealsByDate,
                                   List<DietMealTypeScheduleEntry> schedule) {
        List<String> dailyTypes = DietMealTypeService.mealTypesForDate(schedule, date);
        Set<String> todayMeals = mealsByDate.getOrDefault(date, Set.of());
        List<String> completedTypes = dailyTypes.stream().filter(todayMeals::contains).toList();
        int streak = 0;
        LocalDate cursor = date;
        if (!isComplete(cursor, mealsByDate, schedule)) cursor = cursor.minusDays(1);
        while (!cursor.isBefore(startDate) && isComplete(cursor, mealsByDate, schedule)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return new Result(completedTypes.size(), completedTypes, streak,
                completedTypes.size() == dailyTypes.size(), dailyTypes);
    }

    public static boolean isOfficialType(String mealType) {
        return TYPE_SET.contains(DietMealTypeService.canonicalMealTypeLabel(mealType));
    }

    public static Map<LocalDate, Set<String>> addMeal(Map<LocalDate, Set<String>> mealsByDate,
                                                       LocalDate date, String mealType) {
        if (!isOfficialType(mealType)) return mealsByDate;
        mealsByDate.computeIfAbsent(date, ignored -> new LinkedHashSet<>())
                .add(DietMealTypeService.canonicalMealTypeLabel(mealType));
        return mealsByDate;
    }

    private static boolean isComplete(LocalDate date, Map<LocalDate, Set<String>> mealsByDate,
                                      List<DietMealTypeScheduleEntry> schedule) {
        List<String> requiredTypes = DietMealTypeService.mealTypesForDate(schedule, date);
        Collection<String> meals = mealsByDate.get(date);
        return meals != null && meals.containsAll(requiredTypes);
    }

    public record Result(int completedMeals, List<String> completedMealTypes,
                         int streakDays, boolean completed, List<String> mealTypes) {}
}
