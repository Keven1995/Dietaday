package com.dietapp.water;

import com.dietapp.user.User;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.Period;

@Service
public class WaterGoalSuggestionService {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private static final BigDecimal MILLILITERS_PER_KILOGRAM = new BigDecimal("35");
    private static final BigDecimal GOAL_INCREMENT_ML = new BigDecimal("50");
    private static final int MIN_GOAL_ML = 2000;
    private static final int MAX_GOAL_ML = 4000;

    private final Clock clock;

    public WaterGoalSuggestionService(Clock clock) {
        this.clock = clock;
    }

    public Integer suggestedGoalMl(User user) {
        if (user.getBirthDate() == null || user.getWeightKg() == null) return null;

        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        if (user.getBirthDate().isAfter(today) || Period.between(user.getBirthDate(), today).getYears() < 18) {
            return null;
        }

        BigDecimal estimatedMl = user.getWeightKg().multiply(MILLILITERS_PER_KILOGRAM);
        int roundedGoalMl = roundToNearest50Ml(estimatedMl);
        return roundedGoalMl >= MIN_GOAL_ML && roundedGoalMl <= MAX_GOAL_ML ? roundedGoalMl : null;
    }

    static int roundToNearest50Ml(BigDecimal amountMl) {
        return amountMl.divide(GOAL_INCREMENT_ML, 0, RoundingMode.HALF_UP)
                .multiply(GOAL_INCREMENT_ML)
                .intValueExact();
    }
}
