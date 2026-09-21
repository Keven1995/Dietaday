package com.dietapp.water;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PushSubscriptionRequest(
        @NotBlank @Size(max = 2048) String endpoint,
        @NotBlank @Size(max = 255) String p256dh,
        @NotBlank @Size(max = 255) String auth) {
}
