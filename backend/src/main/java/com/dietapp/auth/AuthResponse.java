package com.dietapp.auth;

import java.util.UUID;
import java.time.LocalDate;
import com.dietapp.user.UserSex;

public record AuthResponse(String token, UUID userId, String email, String fullName, UserSex sex, LocalDate birthDate) {
}
