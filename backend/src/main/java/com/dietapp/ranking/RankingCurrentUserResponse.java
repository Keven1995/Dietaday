package com.dietapp.ranking;

import java.util.UUID;

public record RankingCurrentUserResponse(UUID userId, int position,
                                        int officialPoints, int pendingPoints) {
}
