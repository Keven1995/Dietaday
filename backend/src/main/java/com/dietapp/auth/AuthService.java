package com.dietapp.auth;

import com.dietapp.common.ConflictException;
import com.dietapp.security.JwtService;
import com.dietapp.security.LoginAttemptService;
import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {
    private static final String INVALID_CREDENTIALS = "Invalid email or password";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttempts;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtService jwtService,
                       LoginAttemptService loginAttempts) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.loginAttempts = loginAttempts;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Email already registered");
        }

        User user;
        try {
            user = users.saveAndFlush(new User(
                    email,
                    passwordEncoder.encode(request.password()),
                    request.fullName().trim(),
                    request.sex()));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Email already registered", exception);
        }
        return responseFor(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request, String clientAddress) {
        String email = normalizeEmail(request.email());
        String attemptKey = email + '|' + clientAddress;
        loginAttempts.checkAllowed(attemptKey);
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (BadCredentialsException exception) {
            loginAttempts.recordFailure(attemptKey);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }
        loginAttempts.recordSuccess(attemptKey);
        User user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadCredentialsException(INVALID_CREDENTIALS));
        return responseFor(user);
    }

    AuthResponse responseFor(User user) {
        return new AuthResponse(jwtService.generate(user.getId()), user.getId(), user.getEmail(), user.getFullName(), user.getSex());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
