package com.dietapp.auth;

import jakarta.validation.constraints.NotBlank;

public record EmailVerificationRequest(@NotBlank String token) {}
