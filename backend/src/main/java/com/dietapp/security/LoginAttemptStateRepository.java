package com.dietapp.security;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface LoginAttemptStateRepository extends JpaRepository<LoginAttemptState, String> {
    @Modifying
    @Query(value = "INSERT INTO login_attempt_states " +
            "(attempt_key_hash, window_started_at, failure_count, in_flight_count, blocked_until, updated_at) " +
            "SELECT :keyHash, :now, 0, 0, NULL, :now " +
            "WHERE NOT EXISTS (SELECT 1 FROM login_attempt_states WHERE attempt_key_hash = :keyHash)",
            nativeQuery = true)
    int insertIfMissing(@Param("keyHash") String keyHash, @Param("now") Instant now);

    @Modifying
    @Query(value = "UPDATE login_attempt_states SET " +
            "window_started_at = CASE WHEN window_started_at <= :windowCutoff THEN :now ELSE window_started_at END, " +
            "failure_count = CASE WHEN window_started_at <= :windowCutoff THEN 0 ELSE failure_count END, " +
            "in_flight_count = CASE WHEN window_started_at <= :windowCutoff THEN 1 ELSE in_flight_count + 1 END, " +
            "blocked_until = CASE WHEN window_started_at <= :windowCutoff THEN NULL ELSE blocked_until END, " +
            "updated_at = :now " +
            "WHERE attempt_key_hash = :keyHash " +
            "AND (blocked_until IS NULL OR blocked_until <= :now) " +
            "AND (window_started_at <= :windowCutoff OR failure_count + in_flight_count < :limit)",
            nativeQuery = true)
    int reserve(@Param("keyHash") String keyHash, @Param("now") Instant now,
                @Param("windowCutoff") Instant windowCutoff, @Param("limit") int limit);

    @Modifying
    @Query(value = "UPDATE login_attempt_states SET " +
            "window_started_at = CASE WHEN window_started_at <= :windowCutoff THEN :now ELSE window_started_at END, " +
            "failure_count = CASE WHEN window_started_at <= :windowCutoff THEN 1 ELSE failure_count + 1 END, " +
            "in_flight_count = CASE WHEN in_flight_count > 0 THEN in_flight_count - 1 ELSE 0 END, " +
            "blocked_until = CASE " +
            "WHEN (CASE WHEN window_started_at <= :windowCutoff THEN 1 ELSE failure_count + 1 END) >= :limit " +
            "THEN :blockedUntil ELSE blocked_until END, " +
            "updated_at = :now WHERE attempt_key_hash = :keyHash", nativeQuery = true)
    int recordFailure(@Param("keyHash") String keyHash, @Param("now") Instant now,
                      @Param("windowCutoff") Instant windowCutoff,
                      @Param("blockedUntil") Instant blockedUntil, @Param("limit") int limit);

    @Modifying
    @Query(value = "UPDATE login_attempt_states SET failure_count = 0, " +
            "in_flight_count = CASE WHEN in_flight_count > 0 THEN in_flight_count - 1 ELSE 0 END, " +
            "window_started_at = :now, blocked_until = NULL, updated_at = :now " +
            "WHERE attempt_key_hash = :keyHash", nativeQuery = true)
    int recordSuccess(@Param("keyHash") String keyHash, @Param("now") Instant now);

    @Modifying
    @Query(value = "UPDATE login_attempt_states SET " +
            "in_flight_count = CASE WHEN in_flight_count > 0 THEN in_flight_count - 1 ELSE 0 END, " +
            "updated_at = :now WHERE attempt_key_hash = :keyHash", nativeQuery = true)
    int release(@Param("keyHash") String keyHash, @Param("now") Instant now);

    @Modifying
    @Query(value = "DELETE FROM login_attempt_states WHERE updated_at < :cutoff", nativeQuery = true)
    int deleteStale(@Param("cutoff") Instant cutoff);
}
