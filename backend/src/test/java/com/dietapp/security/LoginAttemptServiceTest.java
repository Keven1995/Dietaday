package com.dietapp.security;

import com.dietapp.common.RateLimitExceededException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LoginAttemptServiceTest {
    private final LoginAttemptService service = new LoginAttemptService();

    @Test
    void blocksAfterFiveFailuresForSameAttemptKey() {
        String key = "person@example.com|192.0.2.10";

        for (int attempt = 0; attempt < 5; attempt++) {
            service.recordFailure(key);
        }

        assertThrows(RateLimitExceededException.class, () -> service.checkAllowed(key));
    }

    @Test
    void doesNotBlockSameEmailFromAnotherAddress() {
        String email = "person@example.com";
        for (int attempt = 0; attempt < 5; attempt++) {
            service.recordFailure(email + "|192.0.2.10");
        }

        assertDoesNotThrow(() -> service.checkAllowed(email + "|192.0.2.11"));
    }

    @Test
    void successfulLoginClearsFailures() {
        String key = "person@example.com|192.0.2.10";
        service.recordFailure(key);
        service.recordSuccess(key);

        assertDoesNotThrow(() -> service.checkAllowed(key));
    }
}
