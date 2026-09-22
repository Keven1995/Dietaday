package com.dietapp.auth;

import com.dietapp.common.ConflictException;
import com.dietapp.security.JwtService;
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

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
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
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.password()));
        User user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadCredentialsException(INVALID_CREDENTIALS));
        return toResponse(user);
    }

    private AuthResponse toResponse(User user) {
        return new AuthResponse(jwtService.generate(user.getId()), user.getId(), user.getEmail(), user.getFullName(), user.getSex());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
