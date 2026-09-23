package com.dietapp.auth;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.dietapp.common.ForbiddenException;
import com.dietapp.security.SecurityAuditService;
import com.dietapp.security.CurrentUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final String REFRESH_COOKIE = "dietaday_refresh";
    private final AuthService authService;
    private final RefreshTokenService refreshTokens;
    private final boolean secureCookies;
    private final SecurityAuditService audit;
    private final AccountSecurityService accountSecurity;
    private final CurrentUser currentUser;

    public AuthController(AuthService authService, RefreshTokenService refreshTokens,
                           @Value("${app.security.secure-cookies:true}") boolean secureCookies,
                           SecurityAuditService audit, AccountSecurityService accountSecurity,
                           CurrentUser currentUser) {
        this.authService = authService;
        this.refreshTokens = refreshTokens;
        this.secureCookies = secureCookies;
        this.audit = audit;
        this.accountSecurity = accountSecurity;
        this.currentUser = currentUser;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest,
                                 HttpServletResponse response) {
        return withRefreshCookie(authService.register(request), response, httpRequest);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest,
                              HttpServletResponse response) {
        return withRefreshCookie(authService.login(request, httpRequest.getRemoteAddr()), response, httpRequest);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@CookieValue(value = REFRESH_COOKIE, required = false) String value,
                                 @RequestHeader(value = "X-Requested-With", required = false) String requestedWith,
                                 HttpServletRequest request, HttpServletResponse response) {
        requireBrowserRequest(requestedWith);
        RefreshTokenService.IssuedToken issued = refreshTokens.rotate(value, request.getHeader("User-Agent"), request.getRemoteAddr());
        response.addHeader("Set-Cookie", refreshCookie(issued.value()).toString());
        return authService.responseFor(issued.user());
    }

    @PostMapping("/logout")
    public void logout(@CookieValue(value = REFRESH_COOKIE, required = false) String value,
                       @RequestHeader(value = "X-Requested-With", required = false) String requestedWith,
                       HttpServletResponse response) {
        requireBrowserRequest(requestedWith);
        audit.logout(refreshTokens.revoke(value));
        response.addHeader("Set-Cookie", refreshCookie(null).toString());
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody EmailVerificationRequest request) {
        accountSecurity.verifyEmail(request.token());
    }

    @PostMapping("/verification/resend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification() {
        accountSecurity.sendVerification(currentUser.require());
    }

    @PostMapping("/password-reset/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        accountSecurity.requestPasswordReset(request.email());
    }

    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        accountSecurity.resetPassword(request.token(), request.password());
    }

    @GetMapping("/sessions")
    public List<SessionResponse> sessions(@CookieValue(value = REFRESH_COOKIE, required = false) String value) {
        return refreshTokens.sessions(currentUser.id(), refreshTokens.currentSessionId(value));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeSession(@PathVariable UUID sessionId) {
        refreshTokens.revokeOne(currentUser.id(), sessionId);
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(HttpServletResponse response) {
        UUID userId = currentUser.id();
        refreshTokens.revokeAll(userId);
        audit.logout(userId);
        response.addHeader("Set-Cookie", refreshCookie(null).toString());
    }

    private AuthResponse withRefreshCookie(AuthResponse auth, HttpServletResponse response, HttpServletRequest request) {
        response.addHeader("Set-Cookie", refreshCookie(refreshTokens.issue(auth.userId(),
                request.getHeader("User-Agent"), request.getRemoteAddr()).value()).toString());
        return auth;
    }

    private ResponseCookie refreshCookie(String value) {
        return ResponseCookie.from(REFRESH_COOKIE, value == null ? "" : value)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite(secureCookies ? "None" : "Lax")
                .path("/")
                .maxAge(value == null ? 0 : 30 * 24 * 60 * 60L)
                .build();
    }

    private void requireBrowserRequest(String requestedWith) {
        if (!"Dietaday".equals(requestedWith)) {
            throw new ForbiddenException("Invalid browser request");
        }
    }
}
