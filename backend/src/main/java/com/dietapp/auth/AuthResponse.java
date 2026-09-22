package com.dietapp.auth;

import java.util.UUID;
import com.dietapp.user.UserSex;

public record AuthResponse(String token, UUID userId, String email, String fullName, UserSex sex) {
}
