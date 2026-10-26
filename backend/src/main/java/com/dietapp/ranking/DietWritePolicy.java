package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;

import java.time.LocalDate;

public final class DietWritePolicy {
    private DietWritePolicy() {}

    public static void validateMealWriteToday(Diet diet, LocalDate today) {
        if (diet.isCompetitiveMode()) {
            CompetitivePeriodPolicy.validateWriteToday(diet, today);
            return;
        }

        if (today.isAfter(diet.getEndDate())) {
            throw new ConflictException("The diet period has ended");
        }
    }
}
