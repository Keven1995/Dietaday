package com.dietapp.meal;

import com.dietapp.ranking.CompetitiveMealType;

import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DailyMealGoal {
    public static final int TARGET = CompetitiveMealType.values().length;
    public static final List<String> TYPES = List.of(
            "Café da manhã",
            "Lanche da manhã",
            "Almoço",
            "Lanche da tarde",
            "Jantar",
            "Ceia");
    private static final Set<String> TYPE_SET = Set.copyOf(TYPES);

    private DailyMealGoal() {}

    public static Result calculate(LocalDate date, LocalDate startDate,
                                   Map<LocalDate, Set<String>> mealsByDate) {
        Set<String> todayMeals = mealsByDate.getOrDefault(date, Set.of());
        List<String> completedTypes = TYPES.stream().filter(todayMeals::contains).toList();
        int streak = 0;
        LocalDate cursor = date;
        if (!isComplete(mealsByDate.get(cursor))) cursor = cursor.minusDays(1);
        while (!cursor.isBefore(startDate) && isComplete(mealsByDate.get(cursor))) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return new Result(completedTypes.size(), completedTypes, streak, completedTypes.size() == TARGET);
    }

    public static boolean isOfficialType(String mealType) {
        return TYPE_SET.contains(mealType);
    }

    public static Map<LocalDate, Set<String>> addMeal(Map<LocalDate, Set<String>> mealsByDate,
                                                       LocalDate date, String mealType) {
        if (!isOfficialType(mealType)) return mealsByDate;
        mealsByDate.computeIfAbsent(date, ignored -> new LinkedHashSet<>()).add(mealType);
        return mealsByDate;
    }

    private static boolean isComplete(Collection<String> meals) {
        return meals != null && meals.containsAll(TYPE_SET);
    }

    public record Result(int completedMeals, List<String> completedMealTypes,
                         int streakDays, boolean completed) {}
}
