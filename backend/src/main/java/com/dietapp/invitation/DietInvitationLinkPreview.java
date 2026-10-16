package com.dietapp.invitation;

import java.time.Instant;
import java.util.UUID;

public record DietInvitationLinkPreview(UUID dietId, String dietName, String inviterName, Instant expiresAt) {
    public static DietInvitationLinkPreview from(DietInvitationLink link) {
        return new DietInvitationLinkPreview(
                link.getDiet().getId(),
                link.getDiet().getName(),
                link.getCreator().getFullName(),
                link.getExpiresAt());
    }
}
