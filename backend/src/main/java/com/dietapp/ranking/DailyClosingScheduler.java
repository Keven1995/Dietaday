package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

@Component
public class DailyClosingScheduler {
    private static final String ZONE = "America/Sao_Paulo";

    private final DietRepository diets;
    private final DailyClosingService closing;
    private final RankingFinalizationService finalization;
    private final Clock clock;

    public DailyClosingScheduler(DietRepository diets, DailyClosingService closing,
                                 RankingFinalizationService finalization, Clock clock) {
        this.diets = diets;
        this.closing = closing;
        this.finalization = finalization;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 0 * * *", zone = ZONE)
    public void closePreviousDay() {
        closeUntil(LocalDate.now(clock.withZone(DailyClosingCalculator.ZONE)).minusDays(1));
    }

    public void closeDate(LocalDate eventDate) {
        for (Diet diet : diets.findAllByCompetitiveModeTrue()) {
            closing.closeDiet(diet.getId(), eventDate);
            finalization.finalizeIfEnded(diet.getId());
        }
    }

    public void closeDate(UUID dietId, LocalDate eventDate) {
        diets.findById(dietId).filter(Diet::isCompetitiveMode).ifPresent(diet -> {
            closing.closeDiet(diet.getId(), eventDate);
            finalization.finalizeIfEnded(diet.getId());
        });
    }

    private void closeUntil(LocalDate lastDate) {
        for (Diet diet : diets.findAllByCompetitiveModeTrue()) {
            LocalDate firstDate = diet.getStartDate();
            LocalDate finalDate = lastDate.isBefore(diet.getEndDate()) ? lastDate : diet.getEndDate();
            for (LocalDate date = firstDate; !date.isAfter(finalDate); date = date.plusDays(1)) {
                closing.closeDiet(diet.getId(), date);
            }
            finalization.finalizeIfEnded(diet.getId());
        }
    }
}
