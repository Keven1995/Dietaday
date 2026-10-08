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
    private final WaterGoalSuggestionService goalSuggestions;
    private final WaterDailyGoalRepository dailyGoals;

    public WaterTrackingService(UserRepository users, WaterCheckRepository checks, CurrentUser currentUser,
                                DietService diets, RankingPointEventService rankingEvents,
                                WaterGoalSuggestionService goalSuggestions, WaterDailyGoalRepository dailyGoals) {
        this.users = users;
        this.checks = checks;
        this.currentUser = currentUser;
        this.diets = diets;
        this.rankingEvents = rankingEvents;
        this.goalSuggestions = goalSuggestions;
        this.dailyGoals = dailyGoals;
    }

    @Transactional(readOnly = true)
    public WaterTodayResponse today() {
        User user = currentUser.require();
        return snapshot(user, LocalDate.now(BRASILIA));
    }

    @Transactional(readOnly = true)
    public boolean hasEverChecked() {
        return checks.existsByUserId(currentUser.id());
    }

    @Transactional
    public WaterTodayResponse updateGoal(int goalMl) {
        validateGoal(goalMl);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        user.updateDailyWaterGoal(goalMl);
        LocalDate date = LocalDate.now(BRASILIA);
        upsertDailyGoal(user, null, date);
        return snapshot(user, date);
    }

    @Transactional
    public WaterTodayResponse addCheck(int amountMl) {
        validateCheck(amountMl);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        LocalDate date = LocalDate.now(BRASILIA);
        List<WaterCheck> today = checks.findByUserIdAndCheckDateOrderByCreatedAtAsc(user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int remaining = user.getDailyWaterGoalMl() - consumed;
        if (remaining <= 0) throw new BadRequestException("Sua meta de água de hoje já foi concluída.");
        if (amountMl > remaining) throw new BadRequestException("Esse check ultrapassa o volume restante da sua meta.");
        checks.save(new WaterCheck(user, amountMl, date));
        upsertDailyGoal(user, null, date);
        return snapshot(user, date);
    }

    @Transactional(readOnly = true)
    public WaterTodayResponse competitiveToday(java.util.UUID dietId) {
        Diet diet = requireCompetitiveDiet(dietId);
        return competitiveSnapshot(diet, currentUser.require(), LocalDate.now(BRASILIA));
    }

    @Transactional
    public WaterTodayResponse updateCompetitiveGoal(java.util.UUID dietId, int goalMl) {
        validateGoal(goalMl);
        Diet diet = requireCompetitiveDietForUpdate(dietId);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        user.updateDailyWaterGoal(goalMl);
        LocalDate date = LocalDate.now(BRASILIA);
        upsertDailyGoal(user, diet, date);
        return competitiveSnapshot(diet, user, date);
    }

    @Transactional
    public WaterTodayResponse addCompetitiveCheck(java.util.UUID dietId, int amountMl) {
        validateCheck(amountMl);
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
        upsertDailyGoal(user, diet, date);
        int pointsEarned = rankingEvents.recordWater(check, remaining);
        WaterTodayResponse snapshot = competitiveSnapshot(diet, user, date);
        return new WaterTodayResponse(snapshot.date(), snapshot.goalMl(), snapshot.consumedMl(), snapshot.remainingMl(),
                snapshot.percentage(), snapshot.checks(), pointsEarned, snapshot.suggestedGoalMl());
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
                today.stream().map(WaterCheckResponse::from).toList(), 0,
                goalSuggestions.suggestedGoalMl(user));
    }

    private WaterTodayResponse snapshot(User user, LocalDate date) {
        List<WaterCheck> today = checks.findByUserIdAndCheckDateOrderByCreatedAtAsc(user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int goal = user.getDailyWaterGoalMl();
        int percentage = Math.min(100, Math.round(consumed * 100f / goal));
        return new WaterTodayResponse(date, goal, consumed, Math.max(0, goal - consumed), percentage,
                today.stream().map(WaterCheckResponse::from).toList(), 0,
                goalSuggestions.suggestedGoalMl(user));
    }

    private void validateGoal(int goalMl) {
        if (goalMl < 2000 || goalMl > 4000 || goalMl % 50 != 0) {
            throw new BadRequestException("A meta deve estar entre 2 L e 4 L, em intervalos de 50 ml.");
        }
    }

    private void validateCheck(int amountMl) {
        if (amountMl < 500 || amountMl > 4000 || amountMl % 500 != 0) {
            throw new BadRequestException("O check deve estar entre 500 ml e 4 L, em intervalos de 500 ml.");
        }
    }

    private void upsertDailyGoal(User user, Diet diet, LocalDate date) {
        WaterDailyGoal dailyGoal = diet == null
                ? dailyGoals.findByUserIdAndGoalDateAndDietIsNull(user.getId(), date).orElse(null)
                : dailyGoals.findByUserIdAndDietIdAndGoalDate(user.getId(), diet.getId(), date).orElse(null);
        if (dailyGoal == null) {
            dailyGoals.save(new WaterDailyGoal(user, diet, date, user.getDailyWaterGoalMl()));
        } else {
            dailyGoal.updateGoalMl(user.getDailyWaterGoalMl());
        }
    }
}
