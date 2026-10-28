package com.dietapp.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AccountActionTokenRepository extends JpaRepository<AccountActionToken, UUID> {
    Optional<AccountActionToken> findByTokenHashAndType(String tokenHash, AccountActionToken.Type type);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AccountActionToken token set token.usedAt = :now " +
            "where token.tokenHash = :tokenHash and token.type = :type " +
            "and token.usedAt is null and token.expiresAt > :now")
    int consumeIfActive(@Param("tokenHash") String tokenHash,
                        @Param("type") AccountActionToken.Type type,
                        @Param("now") Instant now);

    long deleteByExpiresAtBefore(Instant cutoff);
}
