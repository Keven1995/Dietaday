package com.dietapp.water;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record WaterCheckRequest(
        @NotNull @Min(500) @Max(4000) Integer amountMl) {}
