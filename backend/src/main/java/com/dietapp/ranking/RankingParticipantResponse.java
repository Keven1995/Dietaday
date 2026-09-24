package com.dietapp.ranking;

import java.time.Instant;
import java.util.UUID;

public record RankingParticipantResponse(int position, UUID userId, String displayName,
                                        int officialPoints, int activeDays,
                                        Instant firstReachedAt) {
}
