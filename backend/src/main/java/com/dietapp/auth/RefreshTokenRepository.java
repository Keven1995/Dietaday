package com.dietapp.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE refresh_tokens SET last_used_at = :now, revoked_at = :now " +
            "WHERE token_hash = :tokenHash AND revoked_at IS NULL AND expires_at > :now", nativeQuery = true)
    int rotateIfActive(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE refresh_tokens SET revoked_at = :now " +
            "WHERE token_hash = :tokenHash AND revoked_at IS NULL AND expires_at > :now", nativeQuery = true)
    int revokeIfActive(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

    long deleteByExpiresAtBefore(Instant cutoff);

    List<RefreshToken> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = :userId AND revoked_at IS NULL", nativeQuery = true)
    int revokeAllByUserId(@Param("userId") UUID userId);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = :tokenId AND user_id = :userId", nativeQuery = true)
    int revokeByIdAndUserId(@Param("tokenId") UUID tokenId, @Param("userId") UUID userId);
}
