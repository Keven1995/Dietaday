package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DailyClosingSchedulerTest {
    @Test
    void closesThePreviousSaoPauloDayForEveryCompetitiveDiet() {
        DietRepository diets = mock(DietRepository.class);
        DailyClosingService closing = mock(DailyClosingService.class);
        RankingFinalizationService finalization = mock(RankingFinalizationService.class);
        Clock clock = Clock.fixed(Instant.parse("2026-09-24T03:30:00Z"),
                ZoneId.of("America/Sao_Paulo"));
        Diet first = new Diet("First", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), true);
        Diet second = new Diet("Second", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), true);
        when(diets.findAllByCompetitiveModeTrue()).thenReturn(List.of(first, second));
        DailyClosingScheduler scheduler = new DailyClosingScheduler(diets, closing, finalization, clock);

        scheduler.closePreviousDay();

        verify(closing).closeDiet(first.getId(), LocalDate.of(2026, 9, 23));
        verify(closing).closeDiet(second.getId(), LocalDate.of(2026, 9, 23));
    }

    @Test
    void supportsExplicitDateReprocessing() {
        DietRepository diets = mock(DietRepository.class);
        DailyClosingService closing = mock(DailyClosingService.class);
        RankingFinalizationService finalization = mock(RankingFinalizationService.class);
        Diet diet = new Diet("Competition", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), true);
        when(diets.findAllByCompetitiveModeTrue()).thenReturn(List.of(diet));
        DailyClosingScheduler scheduler = new DailyClosingScheduler(diets, closing, finalization,
                Clock.system(ZoneId.of("America/Sao_Paulo")));

        scheduler.closeDate(LocalDate.of(2026, 9, 20));

        verify(closing).closeDiet(diet.getId(), LocalDate.of(2026, 9, 20));
    }
}
