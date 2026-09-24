package com.dietapp.ranking;

import java.util.UUID;

public record RankingEntryResponse(int position, UUID userId, String fullName, int points, long activeDays) {}
