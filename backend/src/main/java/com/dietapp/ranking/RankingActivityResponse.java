package com.dietapp.ranking;

import java.time.Instant;
import java.util.UUID;

public record RankingActivityResponse(UUID eventId, String sourceType, Instant createdAt) {
    public static RankingActivityResponse empty() {
        return new RankingActivityResponse(null, null, null);
    }
}
