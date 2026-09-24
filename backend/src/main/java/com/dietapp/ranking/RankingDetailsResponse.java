package com.dietapp.ranking;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record RankingDetailsResponse(UUID userId, int pendingPoints,
                                     Map<String, Integer> mealCountByType,
                                     int eligibleWaterChecks,
                                     List<RankingEventResponse> events,
                                     RankingPageResponse page) {
}
