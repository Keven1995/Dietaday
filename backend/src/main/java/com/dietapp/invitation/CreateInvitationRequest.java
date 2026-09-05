package com.dietapp.invitation;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateInvitationRequest(@NotBlank @Email @Size(max = 255) String email) {
}
