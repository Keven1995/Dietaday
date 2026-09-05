package com.dietapp.meal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record MealRequest(
        @NotBlank @Size(max = 30) String mealType,
        @NotBlank @Size(max = 1000) String description,
        @NotNull LocalDate mealDate,
        @Size(max = 1000) String photoUrl) {
}
