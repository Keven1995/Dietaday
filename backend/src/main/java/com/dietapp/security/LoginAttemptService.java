package com.dietapp.security;

import com.dietapp.common.RateLimitExceededException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginAttemptService {
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final Duration BLOCK = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, AttemptState> attempts = new ConcurrentHashMap<>();

    public void checkAllowed(String email) {
        AttemptState state = attempts.get(email);
        if (state == null) {
            return;
        }

        Instant now = Instant.now();
        synchronized (state) {
            if (state.blockedUntil != null && now.isBefore(state.blockedUntil)) {
                throw new RateLimitExceededException("Too many login attempts. Try again later.");
            }
            if (state.firstFailure != null && now.isAfter(state.firstFailure.plus(WINDOW))) {
                attempts.remove(email, state);
            }
        }
    }

    public void recordFailure(String email) {
        Instant now = Instant.now();
        attempts.compute(email, (key, existing) -> {
            AttemptState state = existing == null ? new AttemptState() : existing;
            synchronized (state) {
                if (state.firstFailure == null || now.isAfter(state.firstFailure.plus(WINDOW))) {
                    state.firstFailure = now;
                    state.failures = 0;
                    state.blockedUntil = null;
                }
                state.failures++;
                if (state.failures >= MAX_FAILURES) {
                    state.blockedUntil = now.plus(BLOCK);
                }
            }
            return state;
        });
    }

    public void recordSuccess(String email) {
        attempts.remove(email);
    }

    private static final class AttemptState {
        private Instant firstFailure;
        private Instant blockedUntil;
        private int failures;
    }
}
