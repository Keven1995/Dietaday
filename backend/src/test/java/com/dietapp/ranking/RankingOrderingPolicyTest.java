package com.dietapp.ranking;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RankingOrderingPolicyTest {
    @Test
    void ordersByPointsBeforeOtherCriteria() {
        UUID lower = UUID.randomUUID();
        UUID higher = UUID.randomUUID();

        List<RankingParticipant> ordered = RankingOrderingPolicy.sort(List.of(
                new RankingParticipant(lower, 5, 10, Instant.parse("2026-09-01T00:00:00Z"), 1),
                new RankingParticipant(higher, 10, 1, Instant.parse("2026-09-02T00:00:00Z"), 2)));

        assertEquals(higher, ordered.get(0).userId());
    }

    @Test
    void ordersEqualPointsByActiveDays() {
        UUID active = UUID.randomUUID();
        UUID inactive = UUID.randomUUID();

        List<RankingParticipant> ordered = RankingOrderingPolicy.sort(List.of(
                new RankingParticipant(inactive, 10, 2, Instant.parse("2026-09-01T00:00:00Z"), 1),
                new RankingParticipant(active, 10, 3, Instant.parse("2026-09-02T00:00:00Z"), 2)));

        assertEquals(active, ordered.get(0).userId());
    }

    @Test
    void ordersEqualPointsAndDaysByFirstReach() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();

        List<RankingParticipant> ordered = RankingOrderingPolicy.sort(List.of(
                new RankingParticipant(second, 10, 2, Instant.parse("2026-09-03T00:00:00Z"), 1),
                new RankingParticipant(first, 10, 2, Instant.parse("2026-09-02T00:00:00Z"), 2)));

        assertEquals(first, ordered.get(0).userId());
    }

    @Test
    void keepsPersistedInitialOrderWhenEveryoneHasZero() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();

        List<RankingParticipant> ordered = RankingOrderingPolicy.sort(List.of(
                new RankingParticipant(first, 0, 0, null, 20),
                new RankingParticipant(second, 0, 0, null, 10)));

        assertEquals(second, ordered.get(0).userId());
        assertEquals(first, ordered.get(1).userId());
    }
}
