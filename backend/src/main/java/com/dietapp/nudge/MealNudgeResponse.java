package com.dietapp.nudge;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MealNudgeResponse(UUID id, UUID dietId, UUID senderId, String senderName,
                                UUID recipientId, String mealType, String mealLabel,
                                String message, LocalDate mealDate, Instant createdAt, Instant readAt) {
    static MealNudgeResponse from(MealNudge nudge) {
        return new MealNudgeResponse(nudge.getId(), nudge.getDiet().getId(),
                nudge.getSender().getId(), nudge.getSender().getFullName(),
                nudge.getRecipient().getId(), nudge.getMealType().name(),
                nudge.getMealType().label(), nudge.getMealType().message(),
                nudge.getMealDate(), nudge.getCreatedAt(), nudge.getReadAt());
    }
}
