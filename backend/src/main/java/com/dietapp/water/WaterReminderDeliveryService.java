package com.dietapp.water;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
public class WaterReminderDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(WaterReminderDeliveryService.class);

    private final PushSubscriptionRepository subscriptions;
    private final WaterReminderDeliveryRepository deliveries;
    private final PushNotificationService push;
    private final WaterReminderMessageCatalog messages;
    private final WaterReminderSchedule schedule;
    private final Clock clock;

    public WaterReminderDeliveryService(
            PushSubscriptionRepository subscriptions,
            WaterReminderDeliveryRepository deliveries,
            PushNotificationService push,
            WaterReminderMessageCatalog messages,
            WaterReminderSchedule schedule) {
        this.subscriptions = subscriptions;
        this.deliveries = deliveries;
        this.push = push;
        this.messages = messages;
        this.schedule = schedule;
        this.clock = Clock.systemUTC();
    }

    @Scheduled(fixedRate = 30_000)
    @Transactional
    public void sendDueReminders() {
        sendDueReminders(Instant.now(clock));
    }

    void sendDueReminders(Instant instant) {
        if (!push.isConfigured()) return;
        ZonedDateTime now = instant.atZone(WaterReminderSchedule.BRASILIA);
        schedule.slotAt(instant).ifPresent(slot -> {
            LocalDate date = now.toLocalDate();
            Map<java.util.UUID, List<PushSubscription>> byUser = subscriptions.findByEnabledTrue().stream()
                    .collect(Collectors.groupingBy(subscription -> subscription.getUser().getId()));
            for (List<PushSubscription> userSubscriptions : byUser.values()) {
                deliverToUser(userSubscriptions, date, slot);
            }
        });
    }

    private void deliverToUser(List<PushSubscription> userSubscriptions, LocalDate date, String slot) {
        PushSubscription first = userSubscriptions.get(0);
        if (deliveries.existsByUserIdAndReminderDateAndReminderSlot(first.getUser().getId(), date, slot)) return;
        WaterReminderGender gender = messages.genderFor(first.getUser().getFullName());
        String message = messages.messageFor(first.getUser().getFullName(), gender,
                ThreadLocalRandom.current().nextInt(messages.messageCount()));
        boolean sent = userSubscriptions.stream()
                .map(subscription -> push.send(subscription, "Hora da água 💧", message))
                .anyMatch(Boolean.TRUE::equals);
        if (sent) {
            deliveries.save(new WaterReminderDelivery(first.getUser(), date, slot, message));
            log.info("water_reminder_sent userId={} date={} slot={}", first.getUser().getId(), date, slot);
        }
    }
}
