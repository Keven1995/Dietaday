package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.meal.Meal;
import com.dietapp.security.SecurityAuditService;
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
    private final DietMemberRepository members;
    private final SecurityAuditService audit;

    public RankingPointEventService(RankingPointEventRepository events, DietMemberRepository members,
                                    SecurityAuditService audit) {
        this.events = events;
        this.members = members;
        this.audit = audit;
    }

    @Transactional
    public void recordMeal(Meal meal) {
        if (!meal.getDiet().isCompetitiveMode()) return;
        if (alreadyRecorded(RankingPointEvent.SourceType.MEAL, meal.getId())) return;
        requireMember(meal.getDiet().getId(), meal.getAuthor().getId());
        LocalDate today = LocalDate.now(ZONE);
        boolean duplicate = events.existsByDietIdAndUserIdAndEventDateAndMealTypeAndSourceTypeAndStatusNot(
                meal.getDiet().getId(), meal.getAuthor().getId(), meal.getMealDate(), meal.getMealType(),
                RankingPointEvent.SourceType.MEAL, RankingPointEvent.Status.REVOKED);
        MealScoringPolicy.validate(meal.getDiet(), meal, today, duplicate);
        try {
            RankingPointEvent event = events.saveAndFlush(new RankingPointEvent(meal.getDiet(), meal.getAuthor(),
                    RankingPointEvent.SourceType.MEAL, meal.getId(), meal.getMealType(),
                    MealScoringPolicy.POINTS, meal.getMealDate()));
            audit.pointEventCreated(event.getUser().getId(), event.getDiet().getId(), event.getId(),
                    event.getSourceType().name());
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Meal could not be scored twice", exception);
        }
    }

    @Transactional
    public void revokeMeal(java.util.UUID mealId) {
        RankingPointEvent event = events.findBySourceTypeAndSourceId(RankingPointEvent.SourceType.MEAL, mealId)
                .orElse(null);
        events.revokeMeal(mealId);
        if (event != null && event.getStatus() != RankingPointEvent.Status.REVOKED) {
            audit.pointEventRevoked(event.getUser().getId(), event.getDiet().getId(), event.getId(),
                    event.getSourceType().name());
        }
    }

    @Transactional
    public void recordWater(WaterCheck check, int remainingBeforeCheck) {
        if (check.getDiet() == null || !check.getDiet().isCompetitiveMode()) return;
        if (alreadyRecorded(RankingPointEvent.SourceType.WATER_CHECK, check.getId())) return;
        requireMember(check.getDiet().getId(), check.getUser().getId());
        LocalDate today = LocalDate.now(ZONE);
        WaterScoringPolicy.validate(check.getDiet(), check.getCheckDate(), today,
                remainingBeforeCheck, check.getAmountMl());
        try {
            RankingPointEvent event = events.saveAndFlush(new RankingPointEvent(check.getDiet(), check.getUser(),
                    RankingPointEvent.SourceType.WATER_CHECK, check.getId(), null,
                    check.getUser().getDailyWaterGoalMl(),
                    WaterScoringPolicy.POINTS, check.getCheckDate()));
            audit.pointEventCreated(event.getUser().getId(), event.getDiet().getId(), event.getId(),
                    event.getSourceType().name());
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Water check could not be scored twice", exception);
        }
    }

    private boolean alreadyRecorded(RankingPointEvent.SourceType sourceType, java.util.UUID sourceId) {
        return events.findBySourceTypeAndSourceId(sourceType, sourceId).isPresent();
    }

    private void requireMember(java.util.UUID dietId, java.util.UUID userId) {
        if (!members.existsByDietIdAndUserId(dietId, userId)) {
            throw new ForbiddenException("The user is not a member of this diet");
        }
    }
}
