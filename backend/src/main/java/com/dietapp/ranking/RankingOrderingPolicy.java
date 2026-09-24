package com.dietapp.ranking;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

public final class RankingOrderingPolicy {
    private RankingOrderingPolicy() {}

    public static List<RankingParticipant> sort(Collection<RankingParticipant> participants) {
        boolean everyoneHasZero = participants.stream().allMatch(participant -> participant.points() == 0);
        Comparator<RankingParticipant> comparator = Comparator
                .comparingInt(RankingParticipant::points).reversed();
        if (!everyoneHasZero) {
            comparator = comparator
                    .thenComparing(Comparator.comparingInt(RankingParticipant::activeDays).reversed())
                    .thenComparing(RankingOrderingPolicy::firstReachedOrder)
                    .thenComparingLong(RankingParticipant::initialOrder);
        } else {
            comparator = Comparator.comparingLong(RankingParticipant::initialOrder);
        }
        return participants.stream().sorted(comparator).toList();
    }

    private static InstantOrder firstReachedOrder(RankingParticipant participant) {
        return new InstantOrder(participant.firstReachedAt());
    }

    private record InstantOrder(java.time.Instant value) implements Comparable<InstantOrder> {
        @Override
        public int compareTo(InstantOrder other) {
            if (value == null && other.value == null) return 0;
            if (value == null) return 1;
            if (other.value == null) return -1;
            return value.compareTo(other.value);
        }
    }
}
