package com.dietapp.ranking;

import java.time.LocalDate;

public record RankingEventResponse(String sourceType, String mealType, LocalDate eventDate,
                                   int points, String status) {
}
