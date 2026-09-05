package com.dietapp.invitation;

import java.time.Instant;
import java.util.UUID;

public record InvitationResponse(
        UUID id,
        UUID dietId,
        String dietName,
        UUID inviterId,
        String inviterName,
        Instant createdAt
) {
    public static InvitationResponse from(Invitation invitation) {
        return new InvitationResponse(
                invitation.getId(),
                invitation.getDiet().getId(),
                invitation.getDiet().getName(),
                invitation.getInviter().getId(),
                invitation.getInviter().getFullName(),
                invitation.getCreatedAt()
        );
    }
}
