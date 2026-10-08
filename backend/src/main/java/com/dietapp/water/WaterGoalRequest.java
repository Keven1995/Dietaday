package com.dietapp.water;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record WaterGoalRequest(
        @NotNull @Min(2000) @Max(4000) Integer goalMl) {}
