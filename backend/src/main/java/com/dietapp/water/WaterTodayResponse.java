package com.dietapp.water;

import java.time.LocalDate;
import java.util.List;

public record WaterTodayResponse(
        LocalDate date,
        int goalMl,
        int consumedMl,
        int remainingMl,
        int percentage,
        List<WaterCheckResponse> checks) {}
