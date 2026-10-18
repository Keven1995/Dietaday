package com.dietapp.water;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
public class WaterReminderDeliveryProcessor {
    private static final Logger log = LoggerFactory.getLogger(WaterReminderDeliveryProcessor.class);

    private final PushSubscriptionRepository subscriptions;
    private final WaterReminderDeliveryRepository deliveries;
    private final PushNotificationService push;
    private final WaterReminderMessageCatalog messages;

    public WaterReminderDeliveryProcessor(
            PushSubscriptionRepository subscriptions,
            WaterReminderDeliveryRepository deliveries,
            PushNotificationService push,
            WaterReminderMessageCatalog messages) {
        this.subscriptions = subscriptions;
        this.deliveries = deliveries;
        this.push = push;
        this.messages = messages;
    }

    @Transactional
    public void sendDueReminders(Instant instant, String slot) {
        LocalDate date = instant.atZone(WaterReminderSchedule.BRASILIA).toLocalDate();
        Map<UUID, List<PushSubscription>> byUser = subscriptions.findByEnabledTrue().stream()
                .collect(Collectors.groupingBy(subscription -> subscription.getUser().getId()));
        log.info("water_reminder_slot_due date={} slot={} users={} subscriptions={}", date, slot,
                byUser.size(), byUser.values().stream().mapToInt(List::size).sum());
        for (List<PushSubscription> userSubscriptions : byUser.values()) {
            deliverToUser(userSubscriptions, date, slot);
        }
    }

    private void deliverToUser(List<PushSubscription> userSubscriptions, LocalDate date, String slot) {
        PushSubscription first = userSubscriptions.get(0);
        UUID userId = first.getUser().getId();
        if (deliveries.existsByUserIdAndReminderDateAndReminderSlot(userId, date, slot)) return;

        WaterReminderGender gender = messages.genderFor(first.getUser().getSex());
        String message = messages.messageFor(first.getUser().getFullName(), gender,
                ThreadLocalRandom.current().nextInt(messages.messageCount(gender)));
        boolean sent = userSubscriptions.stream()
                .map(subscription -> push.send(subscription, "Hora da água 💧", message))
                .anyMatch(Boolean.TRUE::equals);
        if (sent) {
            deliveries.save(new WaterReminderDelivery(first.getUser(), date, slot, message));
            log.info("water_reminder_sent userId={} date={} slot={}", userId, date, slot);
        }
    }
}
