package com.dietapp.user;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateProfileRequest(
        @NotBlank @Size(max = 120) String fullName,
        @DecimalMin("20.0") @DecimalMax("500.0") BigDecimal weightKg,
        @Min(50) @Max(300) Integer heightCm,
        UserSex sex) {
}
