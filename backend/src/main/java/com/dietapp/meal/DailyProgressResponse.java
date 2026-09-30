package com.dietapp.meal;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DailyProgressResponse(
        UUID dietId,
        LocalDate date,
        int dailyGoal,
        int completedMeals,
        List<String> completedMealTypes,
        boolean dailyGoalCompleted,
        int streakDays) {}
