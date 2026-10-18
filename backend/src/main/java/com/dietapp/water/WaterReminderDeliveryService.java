package com.dietapp.water;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;

@Service
public class WaterReminderDeliveryService {
    private final PushNotificationService push;
    private final WaterReminderSchedule schedule;
    private final WaterReminderDeliveryProcessor processor;
    private final Clock clock;

    public WaterReminderDeliveryService(PushNotificationService push, WaterReminderSchedule schedule,
                                        WaterReminderDeliveryProcessor processor, Clock clock) {
        this.push = push;
        this.schedule = schedule;
        this.processor = processor;
        this.clock = clock;
    }

    @Scheduled(fixedRate = 30_000)
    public void sendDueReminders() {
        sendDueReminders(Instant.now(clock));
    }

    void sendDueReminders(Instant instant) {
        if (!push.isConfigured()) return;
        schedule.slotAt(instant).ifPresent(slot -> processor.sendDueReminders(instant, slot));
    }
}
