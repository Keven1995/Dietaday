package com.dietapp.summary;

import com.dietapp.diet.Diet;
import com.dietapp.invitation.Invitation;
import com.dietapp.invitation.InvitationService;
import com.dietapp.notification.NotificationFeedResponse;
import com.dietapp.notification.NotificationService;
import com.dietapp.notification.UnreadCountResponse;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationSummaryServiceTest {
    @Test
    void combinesNotificationsUnreadCountAndPendingInvitations() {
        NotificationService notifications = mock(NotificationService.class);
        InvitationService invitations = mock(InvitationService.class);

        UUID dietId = UUID.randomUUID();
        NotificationFeedResponse notification = new NotificationFeedResponse(
                UUID.randomUUID(), "MEAL_COMMENTED", dietId, UUID.randomUUID(), LocalDate.now(),
                UUID.randomUUID(), UUID.randomUUID(), "Actor", "LUNCH", null, Instant.now(), null);
        when(notifications.list(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(notification)));
        when(notifications.unreadCount()).thenReturn(new UnreadCountResponse(4));

        Diet diet = new Diet("Summary Diet", LocalDate.now(), LocalDate.now().plusDays(7), false);
        User inviter = new User("inviter@example.com", "hash", "Inviter", UserSex.NEUTRAL);
        User invitee = new User("invitee@example.com", "hash", "Invitee", UserSex.NEUTRAL);
        Invitation invitation = new Invitation(diet, inviter, invitee);
        when(invitations.listPending(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(invitation)));

        NotificationSummaryResponse response = new NotificationSummaryService(notifications, invitations).summary();

        assertThat(response.notifications()).containsExactly(notification);
        assertThat(response.unreadCount()).isEqualTo(4);
        assertThat(response.invitations()).hasSize(1);
        assertThat(response.invitations().get(0).id()).isEqualTo(invitation.getId());
    }
}
