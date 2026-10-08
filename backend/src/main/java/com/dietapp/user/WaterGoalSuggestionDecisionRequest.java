package com.dietapp.user;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record WaterGoalSuggestionDecisionRequest(
        @NotNull Decision decision,
        UUID dietId) {
    public enum Decision {
        KEEP_CURRENT,
        APPLY_RECOMMENDATION
    }
}
