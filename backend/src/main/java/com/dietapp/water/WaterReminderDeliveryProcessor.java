package com.dietapp.water;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import com.dietapp.user.UserRepository;

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
    private final UserRepository users;
    private final TransactionTemplate claimTransaction;

    public WaterReminderDeliveryProcessor(
            PushSubscriptionRepository subscriptions,
            WaterReminderDeliveryRepository deliveries,
            PushNotificationService push,
            WaterReminderMessageCatalog messages,
            UserRepository users,
            PlatformTransactionManager transactionManager) {
        this.subscriptions = subscriptions;
        this.deliveries = deliveries;
        this.push = push;
        this.messages = messages;
        this.users = users;
        this.claimTransaction = new TransactionTemplate(transactionManager);
        this.claimTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional
    public void sendDueReminders(Instant instant, String slot) {
        LocalDate date = instant.atZone(WaterReminderSchedule.BRASILIA).toLocalDate();
        Map<UUID, List<PushSubscription>> byUser = subscriptions.findByEnabledTrue().stream()
                .collect(Collectors.groupingBy(subscription -> subscription.getUser().getId()));
        log.info("water_reminder_slot_due date={} slot={} users={} subscriptions={}", date, slot,
                byUser.size(), byUser.values().stream().mapToInt(List::size).sum());
        byUser.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .forEach(userSubscriptions -> deliverToUser(userSubscriptions, date, slot));
    }

    private void deliverToUser(List<PushSubscription> userSubscriptions, LocalDate date, String slot) {
        PushSubscription first = userSubscriptions.get(0);
        UUID userId = first.getUser().getId();

        WaterReminderGender gender = messages.genderFor(first.getUser().getSex());
        String message = messages.messageFor(first.getUser().getFullName(), gender,
                ThreadLocalRandom.current().nextInt(messages.messageCount(gender)));
        if (!claimDelivery(userId, date, slot, message)) return;
        boolean sent = userSubscriptions.stream()
                .map(subscription -> push.send(subscription, "Hora da água 💧", message))
                .anyMatch(Boolean.TRUE::equals);
        if (sent) {
            log.info("water_reminder_sent userId={} date={} slot={}", userId, date, slot);
        } else {
            claimTransaction.executeWithoutResult(status -> deliveries.releaseClaim(userId, date, slot));
        }
    }

    private boolean claimDelivery(UUID userId, LocalDate date, String slot, String message) {
        try {
            // Commit the unique claim before calling the external push provider.
            // This favors at-most-once delivery; a confirmed provider failure releases it below.
            Boolean claimed = claimTransaction.execute(status -> {
                if (deliveries.existsByUserIdAndReminderDateAndReminderSlot(userId, date, slot)) return false;
                deliveries.saveAndFlush(new WaterReminderDelivery(users.getReferenceById(userId), date, slot, message));
                return true;
            });
            return Boolean.TRUE.equals(claimed);
        } catch (DataIntegrityViolationException duplicate) {
            // The unique (user, date, slot) key elects one sender across requests and instances.
            return false;
        }
    }
}
