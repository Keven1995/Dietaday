package com.dietapp.ranking;

import java.time.Instant;
import java.util.UUID;

public record RankingParticipant(UUID userId, int points, int activeDays,
                                Instant firstReachedAt, long initialOrder) {
}
