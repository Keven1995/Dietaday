package com.dietapp.auth;

import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
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
    private final UserRepository users;

    public AccountActionTokenService(AccountActionTokenRepository tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
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
        String tokenHash = hash(value);
        Instant now = Instant.now();
        if (tokens.consumeIfActive(tokenHash, type, now) != 1) {
            throw new BadCredentialsException(INVALID_TOKEN);
        }
        AccountActionToken consumed = tokens.findByTokenHashAndType(tokenHash, type)
                .orElseThrow(() -> new BadCredentialsException(INVALID_TOKEN));
        return users.findForUpdateById(consumed.getUser().getId())
                .orElseThrow(() -> new BadCredentialsException(INVALID_TOKEN));
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
