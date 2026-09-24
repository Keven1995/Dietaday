package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;

@Component
public class DailyClosingScheduler {
    private static final String ZONE = "America/Sao_Paulo";

    private final DietRepository diets;
    private final DailyClosingService closing;
    private final Clock clock;

    public DailyClosingScheduler(DietRepository diets, DailyClosingService closing, Clock clock) {
        this.diets = diets;
        this.closing = closing;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 0 * * *", zone = ZONE)
    public void closePreviousDay() {
        closeDate(LocalDate.now(clock.withZone(DailyClosingCalculator.ZONE)).minusDays(1));
    }

    public void closeDate(LocalDate eventDate) {
        for (Diet diet : diets.findAllByCompetitiveModeTrue()) {
            closing.closeDiet(diet.getId(), eventDate);
        }
    }
}
