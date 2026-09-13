package com.dietapp.notification;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record NotificationResponse(UUID id, Notification.Type type, UUID dietId, UUID mealId,
                                   LocalDate mealDate, UUID commentId, UUID actorId, String actorName,
                                   String mealType, Instant createdAt, Instant readAt) {
    static NotificationResponse from(Notification notification) {
        return new NotificationResponse(notification.getId(), notification.getType(),
                notification.getDiet().getId(), notification.getMeal().getId(),
                notification.getMeal().getMealDate(), notification.getComment().getId(),
                notification.getActor().getId(), notification.getActor().getFullName(),
                notification.getMeal().getMealType(), notification.getCreatedAt(), notification.getReadAt());
    }
}
