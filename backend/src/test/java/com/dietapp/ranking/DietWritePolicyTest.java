package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DietWritePolicyTest {
    @Test
    void allowsNormalDietWritesThroughTheEndDate() {
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        Diet diet = new Diet("Normal", endDate.minusDays(7), endDate, false);

        assertDoesNotThrow(() -> DietWritePolicy.validateMealWriteToday(diet, endDate));
    }

    @Test
    void blocksNormalDietWritesStartingTheDayAfterTheEndDate() {
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        Diet diet = new Diet("Normal", endDate.minusDays(7), endDate, false);

        assertThrows(ConflictException.class, () ->
                DietWritePolicy.validateMealWriteToday(diet, endDate.plusDays(1)));
    }

    @Test
    void preservesCompetitiveDietWritePeriodRules() {
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        Diet diet = new Diet("Competitive", endDate.minusDays(7), endDate, true);

        assertDoesNotThrow(() -> DietWritePolicy.validateMealWriteToday(diet, endDate));
        assertThrows(ConflictException.class, () ->
                DietWritePolicy.validateMealWriteToday(diet, endDate.plusDays(1)));
    }
}
