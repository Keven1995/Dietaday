package com.dietapp.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AccountActionTokenRepository extends JpaRepository<AccountActionToken, UUID> {
    Optional<AccountActionToken> findByTokenHashAndType(String tokenHash, AccountActionToken.Type type);
    long deleteByExpiresAtBefore(Instant cutoff);
}
