package com.dietapp.diet;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record DietRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        boolean competitiveMode) {
}
