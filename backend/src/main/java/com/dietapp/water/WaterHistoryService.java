package com.dietapp.water;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietService;
import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

@Service
public class WaterHistoryService {
    private final CurrentUser currentUser;
    private final DietService diets;
    private final WaterCheckRepository checks;
    private final WaterDailyGoalRepository dailyGoals;

    public WaterHistoryService(CurrentUser currentUser, DietService diets, WaterCheckRepository checks,
                               WaterDailyGoalRepository dailyGoals) {
        this.currentUser = currentUser;
        this.diets = diets;
        this.checks = checks;
        this.dailyGoals = dailyGoals;
    }

    @Transactional(readOnly = true)
    public WaterHistoryResponse generalHistory(String requestedMonth) {
        YearMonth month = parseMonth(requestedMonth);
        return history(currentUser.id(), null, month);
    }

    @Transactional(readOnly = true)
    public WaterHistoryResponse competitiveHistory(UUID dietId, String requestedMonth) {
        YearMonth month = parseMonth(requestedMonth);
        Diet diet = diets.requireMember(dietId);
        if (!diet.isCompetitiveMode()) throw new ConflictException("This diet is not competitive");
        return history(currentUser.id(), diet.getId(), month);
    }

    private WaterHistoryResponse history(UUID userId, UUID dietId, YearMonth month) {
        LocalDate startDate = month.atDay(1);
        LocalDate endDate = month.atEndOfMonth();
        Map<LocalDate, DailyHistory> days = new TreeMap<>();

        List<WaterCheckDailyTotal> totals = dietId == null
                ? checks.sumGeneralByDate(userId, startDate, endDate)
                : checks.sumCompetitiveByDate(userId, dietId, startDate, endDate);
        for (WaterCheckDailyTotal total : totals) {
            DailyHistory day = days.computeIfAbsent(total.getCheckDate(), ignored -> new DailyHistory());
            day.consumedMl = total.getConsumedMl() == null ? 0 : total.getConsumedMl();
            day.hasRecords = true;
        }

        List<WaterDailyGoal> snapshots = dietId == null
                ? dailyGoals.findByUserIdAndGoalDateBetweenAndDietIsNull(userId, startDate, endDate)
                : dailyGoals.findByUserIdAndDietIdAndGoalDateBetween(userId, dietId, startDate, endDate);
        for (WaterDailyGoal snapshot : snapshots) {
            DailyHistory day = days.computeIfAbsent(snapshot.getGoalDate(), ignored -> new DailyHistory());
            day.goalMl = snapshot.getGoalMl();
        }

        List<WaterHistoryDayResponse> responseDays = new ArrayList<>(days.size());
        days.forEach((date, day) -> responseDays.add(toResponse(date, day)));
        return new WaterHistoryResponse(month.toString(), List.copyOf(responseDays));
    }

    private WaterHistoryDayResponse toResponse(LocalDate date, DailyHistory day) {
        int consumedMl = Math.toIntExact(day.consumedMl);
        Integer percentage = null;
        if (day.hasRecords && day.goalMl != null) {
            percentage = (int) Math.min(100, Math.round(consumedMl * 100.0 / day.goalMl));
        }
        return new WaterHistoryDayResponse(date, consumedMl, day.goalMl, percentage, day.hasRecords);
    }

    private YearMonth parseMonth(String value) {
        if (value == null || !value.matches("\\d{4}-(0[1-9]|1[0-2])")) {
            throw new BadRequestException("month deve estar no formato YYYY-MM.");
        }
        try {
            return YearMonth.parse(value);
        } catch (DateTimeException exception) {
            throw new BadRequestException("month deve estar no formato YYYY-MM.");
        }
    }

    private static final class DailyHistory {
        private long consumedMl;
        private Integer goalMl;
        private boolean hasRecords;
    }
}
