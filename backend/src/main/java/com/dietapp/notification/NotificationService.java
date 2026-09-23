package com.dietapp.notification;

import com.dietapp.comment.MealComment;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.meal.Meal;
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
    private final DietMemberRepository members;
    private final CurrentUser currentUser;

    public NotificationService(NotificationRepository notifications, DietMemberRepository members,
                               CurrentUser currentUser) {
        this.notifications = notifications;
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
    public Page<NotificationResponse> list(Pageable pageable) {
        return notifications.findAccessible(currentUser.id(), pageable).map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount() {
        return new UnreadCountResponse(notifications.countUnreadAccessible(currentUser.id()));
    }

    @Transactional
    public void markRead(UUID id) {
        notifications.findAccessibleById(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Notification not found"))
                .markRead();
    }

    @Transactional
    public void markAllRead() {
        notifications.markAllUnread(currentUser.id());
    }
}
