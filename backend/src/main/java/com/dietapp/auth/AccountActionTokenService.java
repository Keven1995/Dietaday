package com.dietapp.auth;

import com.dietapp.user.User;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class AccountActionTokenService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String INVALID_TOKEN = "Invalid or expired account token";
    private final AccountActionTokenRepository tokens;

    public AccountActionTokenService(AccountActionTokenRepository tokens) {
        this.tokens = tokens;
    }

    @Transactional
    public IssuedToken issue(User user, AccountActionToken.Type type, Duration lifetime) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String value = HexFormat.of().formatHex(raw);
        tokens.save(new AccountActionToken(user, type, hash(value), Instant.now().plus(lifetime)));
        return new IssuedToken(value, user);
    }

    @Transactional
    public User consume(String value, AccountActionToken.Type type) {
        if (value == null || value.isBlank()) {
            throw new BadCredentialsException(INVALID_TOKEN);
        }
        AccountActionToken token = tokens.findByTokenHashAndType(hash(value), type)
                .orElseThrow(() -> new BadCredentialsException(INVALID_TOKEN));
        if (!token.isActive(Instant.now())) {
            throw new BadCredentialsException(INVALID_TOKEN);
        }
        token.use();
        return token.getUser();
    }

    @Scheduled(cron = "0 35 3 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public void deleteExpiredTokens() {
        tokens.deleteByExpiresAtBefore(Instant.now());
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    public record IssuedToken(String value, User user) {}
}
