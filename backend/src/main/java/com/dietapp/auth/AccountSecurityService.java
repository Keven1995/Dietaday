package com.dietapp.auth;

import com.dietapp.security.SecurityAuditService;
import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Locale;

@Service
public class AccountSecurityService {
    private static final Duration VERIFICATION_LIFETIME = Duration.ofHours(24);
    private static final Duration RESET_LIFETIME = Duration.ofMinutes(30);
    private final UserRepository users;
    private final AccountActionTokenService tokens;
    private final AccountEmailService emails;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokens;
    private final SecurityAuditService audit;

    public AccountSecurityService(UserRepository users, AccountActionTokenService tokens,
                                 AccountEmailService emails, PasswordEncoder passwordEncoder,
                                 RefreshTokenService refreshTokens, SecurityAuditService audit) {
        this.users = users;
        this.tokens = tokens;
        this.emails = emails;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokens = refreshTokens;
        this.audit = audit;
    }

    @Transactional
    public void sendVerification(User user) {
        var issued = tokens.issue(user, AccountActionToken.Type.EMAIL_VERIFICATION, VERIFICATION_LIFETIME);
        emails.sendVerification(user, issued.value());
    }

    @Transactional
    public void verifyEmail(String token) {
        User user = tokens.consume(token, AccountActionToken.Type.EMAIL_VERIFICATION);
        user.verifyEmail();
    }

    @Transactional
    public void requestPasswordReset(String email) {
        users.findByEmailIgnoreCase(email.trim().toLowerCase(Locale.ROOT)).ifPresent(user -> {
            var issued = tokens.issue(user, AccountActionToken.Type.PASSWORD_RESET, RESET_LIFETIME);
            emails.sendPasswordReset(user, issued.value());
        });
    }

    @Transactional
    public void resetPassword(String token, String password) {
        User user = tokens.consume(token, AccountActionToken.Type.PASSWORD_RESET);
        user.updatePassword(passwordEncoder.encode(password));
        refreshTokens.revokeAll(user.getId());
        audit.profileUpdated(user.getId());
    }
}
