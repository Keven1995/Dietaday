package com.dietapp.summary;

import com.dietapp.invitation.InvitationResponse;
import com.dietapp.notification.NotificationFeedResponse;

import java.util.List;

public record NotificationSummaryResponse(
        List<NotificationFeedResponse> notifications,
        long unreadCount,
        List<InvitationResponse> invitations
) {
}
