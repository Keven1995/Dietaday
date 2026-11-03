package com.dietapp.summary;

import com.dietapp.invitation.Invitation;
import com.dietapp.invitation.InvitationResponse;
import com.dietapp.invitation.InvitationService;
import com.dietapp.notification.NotificationFeedResponse;
import com.dietapp.notification.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationSummaryService {
    private static final int FEED_SIZE = 50;

    private final NotificationService notifications;
    private final InvitationService invitations;

    public NotificationSummaryService(NotificationService notifications, InvitationService invitations) {
        this.notifications = notifications;
        this.invitations = invitations;
    }

    @Transactional(readOnly = true)
    public NotificationSummaryResponse summary() {
        Page<NotificationFeedResponse> notificationPage = notifications.list(PageRequest.of(0, FEED_SIZE));
        Page<Invitation> invitationPage = invitations.listPending(PageRequest.of(0, FEED_SIZE));
        return new NotificationSummaryResponse(
                notificationPage.getContent(),
                notifications.unreadCount().count(),
                invitationPage.getContent().stream().map(InvitationResponse::from).toList()
        );
    }
}
