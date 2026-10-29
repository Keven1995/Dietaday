package com.dietapp.diet;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DietResponse(
        UUID id,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        boolean competitiveMode,
        boolean canManageMealTypes,
        List<DietMealTypeScheduleEntry> mealTypeSchedule) {
}
