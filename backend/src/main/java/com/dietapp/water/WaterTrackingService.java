package com.dietapp.water;

import com.dietapp.common.BadRequestException;
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

    public WaterTrackingService(UserRepository users, WaterCheckRepository checks, CurrentUser currentUser) {
        this.users = users;
        this.checks = checks;
        this.currentUser = currentUser;
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
