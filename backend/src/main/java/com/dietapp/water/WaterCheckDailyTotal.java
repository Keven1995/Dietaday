package com.dietapp.water;

import java.time.LocalDate;

public interface WaterCheckDailyTotal {
    LocalDate getCheckDate();
    Long getConsumedMl();
}
