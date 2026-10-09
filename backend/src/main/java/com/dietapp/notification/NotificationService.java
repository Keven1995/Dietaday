package com.dietapp.notification;

import com.dietapp.comment.MealComment;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.meal.Meal;
import com.dietapp.nudge.MealNudge;
import com.dietapp.nudge.MealNudgeRepository;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

@Service
public class NotificationService {
    private final NotificationRepository notifications;
    private final MealNudgeRepository mealNudges;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;

    public NotificationService(NotificationRepository notifications, MealNudgeRepository mealNudges,
                               DietMemberRepository members,
                               CurrentUser currentUser) {
        this.notifications = notifications;
        this.mealNudges = mealNudges;
        this.members = members;
        this.currentUser = currentUser;
    }

    @Transactional
    public void mealCommented(Diet diet, Meal meal, MealComment comment, User recipient, User actor) {
        if (members.existsByDietIdAndUserId(diet.getId(), recipient.getId())) {
            notifications.save(new Notification(diet, meal, comment, recipient, actor));
        }
    }

    @Transactional(readOnly = true)
    public Page<NotificationFeedResponse> list(Pageable pageable) {
        return notifications.findAccessibleFeed(currentUser.id(), pageable).map(NotificationFeedResponse::from);
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount() {
        return new UnreadCountResponse(notifications.countUnreadAccessible(currentUser.id())
                + mealNudges.countUnreadAccessible(currentUser.id()));
    }

    @Transactional
    public void markRead(UUID id) {
        var commentNotification = notifications.findAccessibleById(id, currentUser.id());
        if (commentNotification.isPresent()) {
            commentNotification.get().markRead();
            return;
        }
        MealNudge nudge = mealNudges.findAccessibleById(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        nudge.markRead(java.time.Instant.now());
    }

    @Transactional
    public void markAllRead() {
        notifications.markAllUnread(currentUser.id());
        mealNudges.markAllUnread(currentUser.id());
    }
}
