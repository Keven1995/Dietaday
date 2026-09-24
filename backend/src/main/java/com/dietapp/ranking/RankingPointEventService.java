package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.meal.Meal;
import com.dietapp.water.WaterCheck;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;

@Service
public class RankingPointEventService {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private final RankingPointEventRepository events;

    public RankingPointEventService(RankingPointEventRepository events) {
        this.events = events;
    }

    @Transactional
    public void recordMeal(Meal meal) {
        if (!meal.getDiet().isCompetitiveMode()) return;
        LocalDate today = LocalDate.now(ZONE);
        boolean duplicate = events.existsByDietIdAndUserIdAndEventDateAndMealTypeAndSourceTypeAndStatusNot(
                meal.getDiet().getId(), meal.getAuthor().getId(), meal.getMealDate(), meal.getMealType(),
                RankingPointEvent.SourceType.MEAL, RankingPointEvent.Status.REVOKED);
        MealScoringPolicy.validate(meal.getDiet(), meal, today, duplicate);
        try {
            events.saveAndFlush(new RankingPointEvent(meal.getDiet(), meal.getAuthor(),
                    RankingPointEvent.SourceType.MEAL, meal.getId(), meal.getMealType(),
                    MealScoringPolicy.POINTS, meal.getMealDate()));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Meal could not be scored twice", exception);
        }
    }

    @Transactional
    public void revokeMeal(java.util.UUID mealId) {
        events.revokeMeal(mealId);
    }

    @Transactional
    public void recordWater(WaterCheck check, int remainingBeforeCheck) {
        if (check.getDiet() == null || !check.getDiet().isCompetitiveMode()) return;
        LocalDate today = LocalDate.now(ZONE);
        WaterScoringPolicy.validate(check.getDiet(), check.getCheckDate(), today,
                remainingBeforeCheck, check.getAmountMl());
        try {
            events.saveAndFlush(new RankingPointEvent(check.getDiet(), check.getUser(),
                    RankingPointEvent.SourceType.WATER_CHECK, check.getId(), null,
                    WaterScoringPolicy.POINTS, check.getCheckDate()));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Water check could not be scored twice", exception);
        }
    }
}
