package com.dietapp.diet;

import java.time.LocalDate;
import java.util.UUID;

public record DietResponse(UUID id, String name, LocalDate startDate, LocalDate endDate, boolean competitiveMode) {
    static DietResponse from(Diet diet) {
        return new DietResponse(diet.getId(), diet.getName(), diet.getStartDate(), diet.getEndDate(), diet.isCompetitiveMode());
    }
}
