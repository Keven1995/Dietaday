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

    long deleteByExpiresAtBefore(Instant cutoff);

    List<RefreshToken> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = :userId AND revoked_at IS NULL", nativeQuery = true)
    int revokeAllByUserId(@Param("userId") UUID userId);

    @Modifying
    @Query(value = "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = :tokenId AND user_id = :userId", nativeQuery = true)
    int revokeByIdAndUserId(@Param("tokenId") UUID tokenId, @Param("userId") UUID userId);
}
