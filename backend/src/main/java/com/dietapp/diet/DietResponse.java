package com.dietapp.diet;

import java.time.LocalDate;
import java.util.UUID;

public record DietResponse(UUID id, String name, LocalDate startDate, LocalDate endDate) {
    static DietResponse from(Diet diet) {
        return new DietResponse(diet.getId(), diet.getName(), diet.getStartDate(), diet.getEndDate());
    }
}
