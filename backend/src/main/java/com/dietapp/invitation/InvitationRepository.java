package com.dietapp.invitation;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {
    @EntityGraph(attributePaths = {"diet", "inviter"})
    List<Invitation> findAllByInviteeIdAndStatusOrderByCreatedAtDesc(UUID inviteeId, Invitation.Status status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"diet", "inviter", "invitee"})
    Optional<Invitation> findForUpdateById(UUID id);
}
