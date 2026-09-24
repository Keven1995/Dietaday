package com.dietapp.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SecurityAuditService {
    private static final Logger log = LoggerFactory.getLogger(SecurityAuditService.class);

    public void loginSuccess(UUID userId) {
        audit("login_success", userId, null, null, null);
    }

    public void loginFailure() {
        audit("login_failure", null, null, null, "invalid_credentials");
    }

    public void loginBlocked() {
        audit("login_blocked", null, null, null, "too_many_attempts");
    }

    public void logout(UUID userId) {
        audit("logout", userId, null, null, null);
    }

    public void profileUpdated(UUID userId) {
        audit("profile_updated", userId, null, null, null);
    }

    public void dietCreated(UUID userId, UUID dietId) {
        audit("diet_created", userId, dietId, null, null);
    }

    public void dietDeleted(UUID userId, UUID dietId) {
        audit("diet_deleted", userId, dietId, null, null);
    }

    public void pointEventCreated(UUID userId, UUID dietId, UUID eventId, String sourceType) {
        audit("ranking_point_event_created", userId, dietId, eventId, safeType(sourceType));
    }

    public void pointEventRevoked(UUID userId, UUID dietId, UUID eventId, String sourceType) {
        audit("ranking_point_event_revoked", userId, dietId, eventId, safeType(sourceType));
    }

    public void rankingDayClosed(UUID dietId, UUID closureId, String eventDate, int eventCount, long durationMs) {
        audit("ranking_day_closed", null, dietId, closureId,
                "date=" + safeType(eventDate) + ",events=" + eventCount + ",durationMs=" + durationMs);
    }

    public void rankingDayCloseFailed(UUID dietId, String eventDate, long durationMs) {
        audit("ranking_day_close_failed", null, dietId, null,
                "date=" + safeType(eventDate) + ",durationMs=" + durationMs);
    }

    public void rankingFinalized(UUID dietId, UUID finalizationId, long durationMs) {
        audit("ranking_finalized", null, dietId, finalizationId, "durationMs=" + durationMs);
    }

    public void memberInvitationCreated(UUID userId, UUID dietId, UUID inviteeId) {
        audit("member_invitation_created", userId, dietId, inviteeId, null);
    }

    public void memberInvitationAccepted(UUID userId, UUID dietId) {
        audit("member_invitation_accepted", userId, dietId, null, null);
    }

    public void memberInvitationDeclined(UUID userId, UUID dietId) {
        audit("member_invitation_declined", userId, dietId, null, null);
    }

    public void memberLeft(UUID userId, UUID dietId) {
        audit("member_left", userId, dietId, null, null);
    }

    public void memberOwnershipTransferred(UUID userId, UUID dietId, UUID successorId) {
        audit("member_ownership_transferred", userId, dietId, successorId, null);
    }

    public void uploadFailure(UUID userId, String errorType) {
        audit("upload_failure", userId, null, null, safeType(errorType));
    }

    public void pushFailure(UUID subscriptionId, Integer status, String errorType) {
        String detail = (status == null ? "unknown" : status) + ":" + safeType(errorType);
        audit("push_failure", null, subscriptionId, null, detail);
    }

    private void audit(String event, UUID actorUserId, UUID resourceId, UUID relatedId, Object detail) {
        log.info("security_audit event={} actorUserId={} resourceId={} relatedId={} detail={}",
                event, actorUserId, resourceId, relatedId, detail);
    }

    private String safeType(String value) {
        return value == null || value.isBlank() ? "unknown" : value.replaceAll("[^A-Za-z0-9_.-]", "_");
    }
}
