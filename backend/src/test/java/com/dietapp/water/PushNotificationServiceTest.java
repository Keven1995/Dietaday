package com.dietapp.water;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PushNotificationServiceTest {
    @Test
    void sanitizesProviderMessageForLogs() {
        String input = "{\"reason\":\"Invalid JWT Token\"}\nnext line";

        assertThat(PushNotificationService.sanitizeProviderMessage(input))
                .isEqualTo("{\"reason\":\"Invalid JWT Token\"} next line");
    }

    @Test
    void limitsProviderMessageLength() {
        assertThat(PushNotificationService.sanitizeProviderMessage("x".repeat(600))).hasSize(512);
    }
}
