package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;

import java.time.LocalDate;

public final class WaterScoringPolicy {
    public static final int POINTS = 2;

    private WaterScoringPolicy() {}

    public static void validate(Diet diet, LocalDate date, LocalDate today, int remaining, int amountMl) {
        if (!diet.isCompetitiveMode()) return;
        CompetitivePeriodPolicy.validateWriteToday(diet, today);
        CompetitivePeriodPolicy.validateEventDate(diet, date);
        if (remaining <= 0 || amountMl > remaining) {
            throw new ConflictException("This water check is not eligible for scoring");
        }
    }
}
