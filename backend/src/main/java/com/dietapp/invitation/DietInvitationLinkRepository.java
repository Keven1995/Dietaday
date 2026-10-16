package com.dietapp.invitation;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DietInvitationLinkRepository extends JpaRepository<DietInvitationLink, UUID> {
    @EntityGraph(attributePaths = {"diet", "creator"})
    Optional<DietInvitationLink> findByTokenHashAndRevokedAtIsNull(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"diet", "creator"})
    Optional<DietInvitationLink> findForUpdateByTokenHashAndRevokedAtIsNull(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"diet", "creator"})
    List<DietInvitationLink> findAllByDietIdAndRevokedAtIsNull(UUID dietId);
}
