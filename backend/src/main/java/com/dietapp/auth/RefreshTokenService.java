package com.dietapp.auth;

import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class RefreshTokenService {
    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final Duration TOKEN_LIFETIME = Duration.ofDays(30);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String INVALID_REFRESH_TOKEN = "Invalid refresh token";

    private final RefreshTokenRepository tokens;
    private final UserRepository users;

    public RefreshTokenService(RefreshTokenRepository tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    @Transactional
    public IssuedToken issue(UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH_TOKEN));
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String value = HexFormat.of().formatHex(raw);
        tokens.save(new RefreshToken(user, hash(value), Instant.now().plus(TOKEN_LIFETIME)));
        return new IssuedToken(value, user);
    }

    @Transactional
    public IssuedToken rotate(String value) {
        if (value == null || value.isBlank()) {
            throw new BadCredentialsException(INVALID_REFRESH_TOKEN);
        }
        RefreshToken current = tokens.findByTokenHash(hash(value))
                .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH_TOKEN));
        if (!current.isActive(Instant.now())) {
            throw new BadCredentialsException(INVALID_REFRESH_TOKEN);
        }
        current.revoke();
        return issue(current.getUser().getId());
    }

    @Transactional
    public UUID revoke(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        var token = tokens.findByTokenHash(hash(value));
        token.ifPresent(RefreshToken::revoke);
        return token.map(refreshToken -> refreshToken.getUser().getId()).orElse(null);
    }

    @Transactional
    @Scheduled(cron = "0 15 3 * * *", zone = "America/Sao_Paulo")
    public void deleteExpiredTokens() {
        long deleted = tokens.deleteByExpiresAtBefore(Instant.now());
        if (deleted > 0) {
            log.info("security_maintenance event=refresh_tokens_cleanup deletedCount={}", deleted);
        }
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
