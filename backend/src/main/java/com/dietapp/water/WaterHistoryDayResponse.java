package com.dietapp.water;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record WaterHistoryDayResponse(
        LocalDate date,
        int consumedMl,
        Integer goalMl,
        Integer percentage,
        boolean hasRecords) {
}
