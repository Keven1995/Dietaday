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
import java.util.List;

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
        return issue(userId, null, null);
    }

    @Transactional
    public IssuedToken issue(UUID userId, String userAgent, String ipAddress) {
        User user = users.findById(userId)
                .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH_TOKEN));
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String value = HexFormat.of().formatHex(raw);
        RefreshToken token = tokens.save(new RefreshToken(user, hash(value), Instant.now().plus(TOKEN_LIFETIME),
                userAgent == null ? null : userAgent.substring(0, Math.min(255, userAgent.length())),
                ipAddress == null ? null : ipAddress.substring(0, Math.min(64, ipAddress.length()))));
        return new IssuedToken(value, user, token.getId());
    }

    @Transactional
    public IssuedToken rotate(String value) {
        return rotate(value, null, null);
    }

    @Transactional
    public IssuedToken rotate(String value, String userAgent, String ipAddress) {
        if (value == null || value.isBlank()) {
            throw new BadCredentialsException(INVALID_REFRESH_TOKEN);
        }
        RefreshToken current = tokens.findByTokenHash(hash(value))
                .orElseThrow(() -> new BadCredentialsException(INVALID_REFRESH_TOKEN));
        if (!current.isActive(Instant.now())) {
            throw new BadCredentialsException(INVALID_REFRESH_TOKEN);
        }
        current.markUsed();
        current.revoke();
        return issue(current.getUser().getId(), userAgent, ipAddress);
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
    public int revokeAll(UUID userId) {
        return tokens.revokeAllByUserId(userId);
    }

    @Transactional
    public int revokeOne(UUID userId, UUID sessionId) {
        return tokens.revokeByIdAndUserId(sessionId, userId);
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> sessions(UUID userId, UUID currentSessionId) {
        return tokens.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(token -> new SessionResponse(token.getId(), token.getCreatedAt(), token.getLastUsedAt(),
                        token.getExpiresAt(), token.getId().equals(currentSessionId)))
                .toList();
    }

    @Transactional(readOnly = true)
    public UUID currentSessionId(String value) {
        if (value == null || value.isBlank()) return null;
        return tokens.findByTokenHash(hash(value)).map(RefreshToken::getId).orElse(null);
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

    public record IssuedToken(String value, User user, UUID sessionId) {}
}
