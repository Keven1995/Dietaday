package com.dietapp.security;

import com.dietapp.common.RateLimitExceededException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class LoginAttemptService {
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final Duration BLOCK = Duration.ofMinutes(15);
    private static final Duration STATE_RETENTION = Duration.ofDays(1);

    private final LoginAttemptStateRepository attempts;
    private final TransactionTemplate transaction;

    public LoginAttemptService(LoginAttemptStateRepository attempts, PlatformTransactionManager transactionManager) {
        this.attempts = attempts;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void reserve(String attemptKey) {
        String keyHash = hash(attemptKey);
        Instant now = Instant.now();
        try {
            transaction.executeWithoutResult(status -> attempts.insertIfMissing(keyHash, now));
        } catch (DataIntegrityViolationException concurrentInsert) {
            // A concurrent request created the row; the conditional UPDATE below arbitrates slots.
        }

        Integer reserved = transaction.execute(status -> attempts.reserve(
                keyHash, now, now.minus(WINDOW), MAX_FAILURES));
        if (reserved == null || reserved != 1) {
            throw new RateLimitExceededException("Too many login attempts. Try again later.");
        }
    }

    public void recordFailure(String attemptKey) {
        Instant now = Instant.now();
        transaction.executeWithoutResult(status -> attempts.recordFailure(
                hash(attemptKey), now, now.minus(WINDOW), now.plus(BLOCK), MAX_FAILURES));
    }

    public void recordSuccess(String attemptKey) {
        Instant now = Instant.now();
        transaction.executeWithoutResult(status -> attempts.recordSuccess(hash(attemptKey), now));
    }

    public void release(String attemptKey) {
        transaction.executeWithoutResult(status -> attempts.release(hash(attemptKey), Instant.now()));
    }

    @Scheduled(cron = "0 25 3 * * *", zone = "America/Sao_Paulo")
    public void deleteStaleAttempts() {
        transaction.executeWithoutResult(status -> attempts.deleteStale(Instant.now().minus(STATE_RETENTION)));
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
