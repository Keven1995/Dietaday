package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.common.BadRequestException;
import com.dietapp.diet.Diet;

import java.time.LocalDate;

public final class CompetitivePeriodPolicy {
    private CompetitivePeriodPolicy() {}

    public static void validateWriteToday(Diet diet, LocalDate today) {
        if (!diet.isCompetitiveMode()) return;
        if (today.isBefore(diet.getStartDate()) || today.isAfter(diet.getEndDate())) {
            throw new ConflictException("The competitive diet is outside its active period");
        }
    }

    public static void validateEventDate(Diet diet, LocalDate eventDate) {
        if (!diet.isCompetitiveMode()) return;
        if (eventDate.isBefore(diet.getStartDate()) || eventDate.isAfter(diet.getEndDate())) {
            throw new BadRequestException("Event date must be within the diet period");
        }
    }
}
