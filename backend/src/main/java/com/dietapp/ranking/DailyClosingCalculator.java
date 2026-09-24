package com.dietapp.ranking;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public final class DailyClosingCalculator {
    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final Clock clock;

    public DailyClosingCalculator(Clock clock) {
        this.clock = clock;
    }

    public DailyClosingTotals calculate(Collection<RankingPointEvent> events) {
        return calculate(events, LocalDate.now(clock.withZone(ZONE)));
    }

    public DailyClosingTotals calculate(Collection<RankingPointEvent> events, LocalDate date) {
        Map<UUID, MutableTotals> totals = new LinkedHashMap<>();
        for (RankingPointEvent event : events) {
            if (!date.equals(event.getEventDate()) || event.getStatus() == RankingPointEvent.Status.REVOKED) {
                continue;
            }

            UUID userId = event.getUser().getId();
            MutableTotals participant = totals.computeIfAbsent(userId, ignored -> new MutableTotals());
            participant.points += event.getPoints();
            if (event.getSourceType() == RankingPointEvent.SourceType.MEAL) {
                participant.meals++;
            } else if (event.getSourceType() == RankingPointEvent.SourceType.WATER_CHECK) {
                participant.waterChecks++;
            }
        }

        Map<UUID, DailyClosingTotals.ParticipantTotals> result = new LinkedHashMap<>();
        totals.forEach((userId, participant) -> result.put(userId,
                new DailyClosingTotals.ParticipantTotals(
                        participant.meals, participant.waterChecks, participant.points)));
        return new DailyClosingTotals(result);
    }

    private static final class MutableTotals {
        private int meals;
        private int waterChecks;
        private int points;
    }
}
