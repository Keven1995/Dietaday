package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;

import java.time.LocalDate;

public final class WaterScoringPolicy {
    public static final int POINTS = 2;

    private WaterScoringPolicy() {}

    public static void validate(Diet diet, LocalDate date, LocalDate today, int remaining, int amountMl) {
        if (!diet.isCompetitiveMode()) return;
        if (today.isBefore(diet.getStartDate()) || today.isAfter(diet.getEndDate())) {
            throw new ConflictException("The competitive diet is outside its active period");
        }
        if (date.isBefore(diet.getStartDate()) || date.isAfter(diet.getEndDate())) {
            throw new ConflictException("Water check date must be within the diet period");
        }
        if (remaining <= 0 || amountMl > remaining) {
            throw new ConflictException("This water check is not eligible for scoring");
        }
    }
}
