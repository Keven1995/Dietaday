package com.dietapp.notification;

import com.dietapp.nudge.MealNudgeType;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.sql.Date;
import java.sql.Timestamp;
import java.nio.ByteBuffer;
import java.util.UUID;

public record NotificationFeedResponse(UUID id, String type, UUID dietId, UUID mealId,
                                       LocalDate mealDate, UUID commentId, UUID actorId,
                                       String actorName, String mealType, String message,
                                       Instant createdAt, Instant readAt) {
    static NotificationFeedResponse from(NotificationRepository.NotificationFeedProjection notification) {
        String message = "MEAL_NUDGED".equals(notification.getType())
                ? MealNudgeType.valueOf(notification.getMealType()).message()
                : null;
        return new NotificationFeedResponse(uuid(notification.getId()), notification.getType(),
                uuid(notification.getDietId()), uuid(notification.getMealId()), localDate(notification.getMealDate()),
                uuid(notification.getCommentId()), uuid(notification.getActorId()), notification.getActorName(),
                notification.getMealType(), message, instant(notification.getCreatedAt()), instant(notification.getReadAt()));
    }

    private static UUID uuid(Object value) {
        if (value == null) return null;
        if (value instanceof UUID uuid) return uuid;
        if (value instanceof byte[] bytes && bytes.length == 16) {
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
            return new UUID(buffer.getLong(), buffer.getLong());
        }
        return UUID.fromString(value.toString());
    }

    private static LocalDate localDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate date) return date;
        if (value instanceof Date date) return date.toLocalDate();
        return LocalDate.parse(value.toString());
    }

    private static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof OffsetDateTime dateTime) return dateTime.toInstant();
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        return Instant.parse(value.toString());
    }
}
