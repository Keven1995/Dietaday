package com.dietapp.user;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record WaterGoalSuggestionReviewResponse(
        WaterGoalSuggestionReviewStatus status,
        Integer suggestedGoalMl) {
}
