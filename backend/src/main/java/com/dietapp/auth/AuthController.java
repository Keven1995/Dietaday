package com.dietapp.auth;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.dietapp.common.ForbiddenException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final String REFRESH_COOKIE = "dietaday_refresh";
    private final AuthService authService;
    private final RefreshTokenService refreshTokens;
    private final boolean secureCookies;

    public AuthController(AuthService authService, RefreshTokenService refreshTokens,
                           @Value("${app.security.secure-cookies:true}") boolean secureCookies) {
        this.authService = authService;
        this.refreshTokens = refreshTokens;
        this.secureCookies = secureCookies;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        return withRefreshCookie(authService.register(request), response);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest,
                              HttpServletResponse response) {
        return withRefreshCookie(authService.login(request, httpRequest.getRemoteAddr()), response);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@CookieValue(value = REFRESH_COOKIE, required = false) String value,
                                @RequestHeader(value = "X-Requested-With", required = false) String requestedWith,
                                HttpServletResponse response) {
        requireBrowserRequest(requestedWith);
        RefreshTokenService.IssuedToken issued = refreshTokens.rotate(value);
        response.addHeader("Set-Cookie", refreshCookie(issued.value()).toString());
        return authService.responseFor(issued.user());
    }

    @PostMapping("/logout")
    public void logout(@CookieValue(value = REFRESH_COOKIE, required = false) String value,
                       @RequestHeader(value = "X-Requested-With", required = false) String requestedWith,
                       HttpServletResponse response) {
        requireBrowserRequest(requestedWith);
        refreshTokens.revoke(value);
        response.addHeader("Set-Cookie", refreshCookie(null).toString());
    }

    private AuthResponse withRefreshCookie(AuthResponse auth, HttpServletResponse response) {
        response.addHeader("Set-Cookie", refreshCookie(refreshTokens.issue(auth.userId()).value()).toString());
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
