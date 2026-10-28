package com.dietapp.security;

import com.dietapp.common.RateLimitExceededException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class LoginAttemptServiceTest {
    @Autowired private LoginAttemptService service;

    @Test
    void blocksAfterFiveFailuresForTheSameAttemptKey() {
        String key = "person@example.com|192.0.2.10|" + UUID.randomUUID();

        for (int attempt = 0; attempt < 5; attempt++) {
            service.reserve(key);
            service.recordFailure(key);
        }

        assertThrows(RateLimitExceededException.class, () -> service.reserve(key));
    }

    @Test
    void doesNotBlockSameEmailFromAnotherAddress() {
        String prefix = "person@example.com|" + UUID.randomUUID();
        String firstAddress = prefix + "|192.0.2.10";
        String otherAddress = prefix + "|192.0.2.11";
        for (int attempt = 0; attempt < 5; attempt++) {
            service.reserve(firstAddress);
            service.recordFailure(firstAddress);
        }

        assertDoesNotThrow(() -> service.reserve(otherAddress));
        service.recordSuccess(otherAddress);
    }

    @Test
    void successfulLoginClearsFailuresAndReleasesItsReservation() {
        String key = "person@example.com|192.0.2.10|" + UUID.randomUUID();
        service.reserve(key);
        service.recordFailure(key);
        service.reserve(key);
        service.recordSuccess(key);

        assertDoesNotThrow(() -> service.reserve(key));
        service.recordSuccess(key);
    }

    @Test
    void simultaneousAttemptsCannotReserveMoreThanTheRemainingFailureSlots() throws Exception {
        String key = "person@example.com|192.0.2.10|" + UUID.randomUUID();
        for (int attempt = 0; attempt < 4; attempt++) {
            service.reserve(key);
            service.recordFailure(key);
        }

        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var attemptLogin = (java.util.concurrent.Callable<Boolean>) () -> {
                ready.countDown();
                if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test did not start");
                try {
                    service.reserve(key);
                    service.recordFailure(key);
                    return true;
                } catch (RateLimitExceededException blocked) {
                    return false;
                }
            };
            Future<Boolean> first = executor.submit(attemptLogin);
            Future<Boolean> second = executor.submit(attemptLogin);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(java.util.stream.Stream.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))
                    .filter(Boolean::booleanValue).count()).isEqualTo(1);
            assertThrows(RateLimitExceededException.class, () -> service.reserve(key));
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }
}
