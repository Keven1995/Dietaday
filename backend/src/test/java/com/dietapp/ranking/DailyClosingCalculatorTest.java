package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DailyClosingCalculatorTest {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private static final LocalDate DATE = LocalDate.of(2026, 9, 24);
    private final DailyClosingCalculator calculator = new DailyClosingCalculator(
            Clock.fixed(Instant.parse("2026-09-24T12:00:00Z"), ZONE));

    @Test
    void sumsOnlyValidEventsForTheRequestedDay() {
        Diet diet = new Diet("Competitive", DATE.minusDays(1), DATE.plusDays(1), true);
        User user = new User("member@example.com", "hash", "Member", UserSex.FEMALE);
        RankingPointEvent meal = new RankingPointEvent(diet, user, RankingPointEvent.SourceType.MEAL,
                UUID.randomUUID(), "Almoço", 5, DATE);
        RankingPointEvent water = new RankingPointEvent(diet, user, RankingPointEvent.SourceType.WATER_CHECK,
                UUID.randomUUID(), null, 2000, 2, DATE);
        RankingPointEvent revoked = new RankingPointEvent(diet, user, RankingPointEvent.SourceType.MEAL,
                UUID.randomUUID(), "Jantar", 5, DATE);
        revoked.revoke();
        RankingPointEvent otherDay = new RankingPointEvent(diet, user, RankingPointEvent.SourceType.MEAL,
                UUID.randomUUID(), "Ceia", 5, DATE.minusDays(1));

        DailyClosingTotals.ParticipantTotals totals = calculator
                .calculate(List.of(meal, water, revoked, otherDay), DATE)
                .participants().get(user.getId());

        assertEquals(new DailyClosingTotals.ParticipantTotals(1, 1, 7), totals);
    }

    @Test
    void calculationIsSeparatedByParticipantAndDeterministic() {
        Diet diet = new Diet("Competitive", DATE.minusDays(1), DATE.plusDays(1), true);
        User first = new User("first@example.com", "hash", "First", UserSex.FEMALE);
        User second = new User("second@example.com", "hash", "Second", UserSex.MALE);
        RankingPointEvent firstEvent = new RankingPointEvent(diet, first, RankingPointEvent.SourceType.MEAL,
                UUID.randomUUID(), "Almoço", 5, DATE);
        RankingPointEvent secondEvent = new RankingPointEvent(diet, second, RankingPointEvent.SourceType.WATER_CHECK,
                UUID.randomUUID(), null, 2000, 2, DATE);

        DailyClosingTotals totals = calculator.calculate(List.of(secondEvent, firstEvent), DATE);

        assertEquals(new DailyClosingTotals.ParticipantTotals(1, 0, 5), totals.participants().get(first.getId()));
        assertEquals(new DailyClosingTotals.ParticipantTotals(0, 1, 2), totals.participants().get(second.getId()));
    }
}
