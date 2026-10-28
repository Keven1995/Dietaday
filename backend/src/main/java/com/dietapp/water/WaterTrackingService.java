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
import org.springframework.dao.DataIntegrityViolationException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

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
    public WaterTodayResponse addCheck(int amountMl, UUID operationId) {
        validateCheckAmount(amountMl);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        LocalDate date = LocalDate.now(BRASILIA);
        String requestHash = waterCheckRequestHash(null, amountMl);
        WaterCheck existing = checks.findByOperationId(operationId).orElse(null);
        if (existing != null) {
            if (!existing.getUser().getId().equals(user.getId()) || existing.getDiet() != null
                    || !requestHash.equals(existing.getRequestHash())) {
                throw new ConflictException("Idempotency key has already been used for another request");
            }
            return snapshot(user, date);
        }
        List<WaterCheck> today = checks.findByUserIdAndCheckDateOrderByCreatedAtAsc(user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int remaining = user.getDailyWaterGoalMl() - consumed;
        validateCheckAgainstRemaining(amountMl, remaining);
        upsertDailyGoal(user, null, date);
        try {
            checks.saveAndFlush(new WaterCheck(user, null, amountMl, date, operationId, requestHash));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Idempotency key has already been used for another request", exception);
        }
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
    public WaterTodayResponse addCompetitiveCheck(UUID dietId, int amountMl, UUID operationId) {
        validateCheckAmount(amountMl);
        Diet diet = requireCompetitiveDietForUpdate(dietId);
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        LocalDate date = LocalDate.now(BRASILIA);
        String requestHash = waterCheckRequestHash(dietId, amountMl);
        WaterCheck existing = checks.findByOperationId(operationId).orElse(null);
        if (existing != null) {
            if (!existing.getUser().getId().equals(user.getId()) || existing.getDiet() == null
                    || !existing.getDiet().getId().equals(dietId)
                    || !requestHash.equals(existing.getRequestHash())) {
                throw new ConflictException("Idempotency key has already been used for another request");
            }
            WaterTodayResponse snapshot = competitiveSnapshot(diet, user, date);
            int pointsEarned = rankingEvents.recordWater(existing, 0);
            return new WaterTodayResponse(snapshot.date(), snapshot.goalMl(), snapshot.consumedMl(),
                    snapshot.remainingMl(), snapshot.percentage(), snapshot.checks(), pointsEarned,
                    snapshot.suggestedGoalMl());
        }
        List<WaterCheck> today = checks.findByDietIdAndUserIdAndCheckDateOrderByCreatedAtAsc(
                diet.getId(), user.getId(), date);
        int consumed = today.stream().mapToInt(WaterCheck::getAmountMl).sum();
        int remaining = user.getDailyWaterGoalMl() - consumed;
        validateCheckAgainstRemaining(amountMl, remaining);
        upsertDailyGoal(user, diet, date);
        WaterCheck check;
        try {
            check = checks.saveAndFlush(new WaterCheck(user, diet, amountMl, date, operationId, requestHash));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Idempotency key has already been used for another request", exception);
        }
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

    private void validateCheckAmount(int amountMl) {
        if (amountMl < 1 || amountMl > 4000 || (amountMl >= 500 && amountMl % 500 != 0)) {
            throw new BadRequestException("O check deve estar entre 500 ml e 4 L, em intervalos de 500 ml, ou corresponder exatamente ao restante menor que 500 ml.");
        }
    }

    private void validateCheckAgainstRemaining(int amountMl, int remainingMl) {
        if (remainingMl <= 0) throw new BadRequestException("Sua meta de água de hoje já foi concluída.");
        if (amountMl < 500 && (remainingMl >= 500 || amountMl != remainingMl)) {
            throw new BadRequestException("Um check abaixo de 500 ml só pode registrar exatamente o restante, quando inferior a 500 ml.");
        }
        if (amountMl > remainingMl) {
            throw new BadRequestException("Esse check ultrapassa o volume restante da sua meta.");
        }
    }

    private void upsertDailyGoal(User user, Diet diet, LocalDate date) {
        WaterDailyGoal dailyGoal = diet == null
                ? dailyGoals.findByUserIdAndGoalDateAndDietIsNull(user.getId(), date).orElse(null)
                : dailyGoals.findByUserIdAndDietIdAndGoalDate(user.getId(), diet.getId(), date).orElse(null);
        if (dailyGoal == null) {
            boolean hasPriorChecks = diet == null
                    ? checks.existsByUserIdAndCheckDate(user.getId(), date)
                    : checks.existsByDietIdAndUserIdAndCheckDate(diet.getId(), user.getId(), date);
            Integer goalMl = hasPriorChecks ? null : user.getDailyWaterGoalMl();
            dailyGoals.save(new WaterDailyGoal(user, diet, date, goalMl));
        } else if (dailyGoal.getGoalMl() != null && dailyGoal.getGoalMl() != user.getDailyWaterGoalMl()) {
            dailyGoal.updateGoalMl(user.getDailyWaterGoalMl());
        }
    }

    private String waterCheckRequestHash(UUID dietId, int amountMl) {
        String value = (dietId == null ? "general" : dietId.toString()) + "\u0000" + amountMl;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
