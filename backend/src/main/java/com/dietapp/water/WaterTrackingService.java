package com.dietapp.water;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietService;
import com.dietapp.ranking.RankingPointEventService;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class WaterTrackingService {
    static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");
    private final UserRepository users;
    private final WaterCheckRepository checks;
    private final CurrentUser currentUser;
    private final DietService diets;
    private final RankingPointEventService rankingEvents;

    public WaterTrackingService(UserRepository users, WaterCheckRepository checks, CurrentUser currentUser,
                                DietService diets, RankingPointEventService rankingEvents) {
        this.users = users;
        this.checks = checks;
        this.currentUser = currentUser;
        this.diets = diets;
        this.rankingEvents = rankingEvents;
    }

    @Transactional(readOnly = true)
    public WaterTodayResponse today() {
        User user = currentUser.require();
        return snapshot(user, LocalDate.now(BRASILIA));
    }

    @Transactional
    public WaterTodayResponse updateGoal(int goalMl) {
        validateAmount(goalMl, "A meta deve estar entre 500 ml e 4 L, em intervalos de 500 ml.");
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        user.updateDailyWaterGoal(goalMl);
        return snapshot(user, LocalDate.now(BRASILIA));
    }

    @Transactional
    public WaterTodayResponse addCheck(int amountMl) {
        validateAmount(amountMl, "O check deve estar entre 500 ml e 4 L, em intervalos de 500 ml.");
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        LocalDate date = LocalDate.now(BRASILIA);
        List<WaterCheck> today = checks.findByUserIdAndCheckDateOrderByCreatedAtAsc(user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int remaining = user.getDailyWaterGoalMl() - consumed;
        if (remaining <= 0) throw new BadRequestException("Sua meta de água de hoje já foi concluída.");
        if (amountMl > remaining) throw new BadRequestException("Esse check ultrapassa o volume restante da sua meta.");
        checks.save(new WaterCheck(user, amountMl, date));
        return snapshot(user, date);
    }

    @Transactional(readOnly = true)
    public WaterTodayResponse competitiveToday(java.util.UUID dietId) {
        Diet diet = requireCompetitiveDiet(dietId);
        return competitiveSnapshot(diet, currentUser.require(), LocalDate.now(BRASILIA));
    }

    @Transactional
    public WaterTodayResponse updateCompetitiveGoal(java.util.UUID dietId, int goalMl) {
        validateAmount(goalMl, "A meta deve estar entre 500 ml e 4 L, em intervalos de 500 ml.");
        Diet diet = requireCompetitiveDietForUpdate(dietId);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        user.updateDailyWaterGoal(goalMl);
        return competitiveSnapshot(diet, user, LocalDate.now(BRASILIA));
    }

    @Transactional
    public WaterTodayResponse addCompetitiveCheck(java.util.UUID dietId, int amountMl) {
        validateAmount(amountMl, "O check deve estar entre 500 ml e 4 L, em intervalos de 500 ml.");
        Diet diet = requireCompetitiveDietForUpdate(dietId);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        LocalDate date = LocalDate.now(BRASILIA);
        List<WaterCheck> today = checks.findByDietIdAndUserIdAndCheckDateOrderByCreatedAtAsc(
                diet.getId(), user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int remaining = user.getDailyWaterGoalMl() - consumed;
        if (remaining <= 0 || amountMl > remaining) {
            throw new BadRequestException("Esse check ultrapassa o volume restante da sua meta.");
        }
        WaterCheck check = checks.save(new WaterCheck(user, diet, amountMl, date));
        rankingEvents.recordWater(check, remaining);
        return competitiveSnapshot(diet, user, date);
    }

    private Diet requireCompetitiveDiet(java.util.UUID dietId) {
        Diet diet = diets.requireMember(dietId);
        if (!diet.isCompetitiveMode()) throw new ConflictException("This diet is not competitive");
        return diet;
    }

    private Diet requireCompetitiveDietForUpdate(java.util.UUID dietId) {
        Diet diet = diets.requireMemberForUpdate(dietId);
        if (!diet.isCompetitiveMode()) throw new ConflictException("This diet is not competitive");
        LocalDate today = LocalDate.now(BRASILIA);
        if (today.isBefore(diet.getStartDate()) || today.isAfter(diet.getEndDate())) {
            throw new ConflictException("The competitive diet is outside its active period");
        }
        return diet;
    }

    private WaterTodayResponse competitiveSnapshot(Diet diet, User user, LocalDate date) {
        List<WaterCheck> today = checks.findByDietIdAndUserIdAndCheckDateOrderByCreatedAtAsc(
                diet.getId(), user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int goal = user.getDailyWaterGoalMl();
        return new WaterTodayResponse(date, goal, consumed, Math.max(0, goal - consumed),
                Math.min(100, Math.round(consumed * 100f / goal)),
                today.stream().map(WaterCheckResponse::from).toList());
    }

    private WaterTodayResponse snapshot(User user, LocalDate date) {
        List<WaterCheck> today = checks.findByUserIdAndCheckDateOrderByCreatedAtAsc(user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int goal = user.getDailyWaterGoalMl();
        int percentage = Math.min(100, Math.round(consumed * 100f / goal));
        return new WaterTodayResponse(date, goal, consumed, Math.max(0, goal - consumed), percentage,
                today.stream().map(WaterCheckResponse::from).toList());
    }

    private void validateAmount(int amountMl, String message) {
        if (amountMl < 500 || amountMl > 4000 || amountMl % 500 != 0) {
            throw new BadRequestException(message);
        }
    }
}
