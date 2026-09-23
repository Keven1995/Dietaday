package com.dietapp.security;

import com.dietapp.common.ApiExceptionHandler.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RequestRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MILLIS = 60_000;
    private static final int TOO_MANY_REQUESTS = 429;

    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RequestRateLimitFilter(ObjectMapper objectMapper,
                                  @Value("${app.security.rate-limit-enabled:true}") boolean enabled) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Rule rule = Rule.forRequest(request.getMethod(), request.getRequestURI());
        if (!enabled || rule == null || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = rule.name() + ':' + request.getRemoteAddr();
        removeStaleBucketsIfNecessary();
        Bucket bucket = buckets.computeIfAbsent(key, ignored -> new Bucket());
        if (!bucket.tryConsume(rule.limit())) {
            response.setStatus(TOO_MANY_REQUESTS);
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(), new ApiError(
                    Instant.now(), TOO_MANY_REQUESTS,
                    "Too many requests. Try again later.", Map.of()));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void removeStaleBucketsIfNecessary() {
        if (buckets.size() <= 10_000) {
            return;
        }
        long cutoff = System.currentTimeMillis() - WINDOW_MILLIS;
        buckets.entrySet().removeIf(entry -> entry.getValue().isOlderThan(cutoff));
    }

    private enum Rule {
        AUTH_REGISTER(30),
        AUTH_LOGIN(20),
        UPLOAD_SIGNATURE(30),
        PUSH_SUBSCRIPTION(60),
        TELEMETRY(120),
        PUSH_TEST(2);

        private final int limit;

        Rule(int limit) {
            this.limit = limit;
        }

        int limit() {
            return limit;
        }

        static Rule forRequest(String method, String path) {
            if (!"POST".equalsIgnoreCase(method)) {
                return null;
            }
            return switch (path) {
                case "/api/auth/register" -> AUTH_REGISTER;
                case "/api/auth/login" -> AUTH_LOGIN;
                case "/api/uploads/signature" -> UPLOAD_SIGNATURE;
                case "/api/push/subscriptions" -> PUSH_SUBSCRIPTION;
                case "/api/telemetry/sync" -> TELEMETRY;
                case "/api/push/test-water" -> PUSH_TEST;
                default -> null;
            };
        }
    }

    private static final class Bucket {
        private long windowStartedAt = System.currentTimeMillis();
        private int count;

        synchronized boolean tryConsume(int limit) {
            long now = System.currentTimeMillis();
            if (now - windowStartedAt >= WINDOW_MILLIS) {
                windowStartedAt = now;
                count = 0;
            }
            if (count >= limit) {
                return false;
            }
            count++;
            return true;
        }

        synchronized boolean isOlderThan(long cutoff) {
            return windowStartedAt < cutoff;
        }
    }
}
