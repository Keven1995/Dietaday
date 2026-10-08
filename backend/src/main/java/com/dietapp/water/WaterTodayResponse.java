package com.dietapp.water;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record WaterTodayResponse(
        LocalDate date,
        int goalMl,
        int consumedMl,
        int remainingMl,
        int percentage,
        List<WaterCheckResponse> checks,
        int pointsEarned,
        Integer suggestedGoalMl) {
    public WaterTodayResponse(LocalDate date, int goalMl, int consumedMl, int remainingMl,
                              int percentage, List<WaterCheckResponse> checks, int pointsEarned) {
        this(date, goalMl, consumedMl, remainingMl, percentage, checks, pointsEarned, null);
    }

    public WaterTodayResponse(LocalDate date, int goalMl, int consumedMl, int remainingMl,
                              int percentage, List<WaterCheckResponse> checks) {
        this(date, goalMl, consumedMl, remainingMl, percentage, checks, 0, null);
    }
}
