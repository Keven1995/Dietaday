package com.dietapp.water;

import com.dietapp.common.BadRequestException;
import com.dietapp.security.CurrentUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/push")
public class WaterReminderTestController {
    private final PushSubscriptionRepository subscriptions;
    private final PushNotificationService push;
    private final WaterReminderMessageCatalog messages;
    private final CurrentUser currentUser;
    private final boolean enabled;

    public WaterReminderTestController(
            PushSubscriptionRepository subscriptions,
            PushNotificationService push,
            WaterReminderMessageCatalog messages,
            CurrentUser currentUser,
            @Value("${app.push.test-enabled:false}") boolean enabled) {
        this.subscriptions = subscriptions;
        this.push = push;
        this.messages = messages;
        this.currentUser = currentUser;
        this.enabled = enabled;
    }

    @PostMapping("/test-water")
    public TestPushResponse sendTestWaterReminder() {
        if (!enabled) throw new BadRequestException("O teste de push está desativado.");
        if (!push.isConfigured()) throw new BadRequestException("Notificações não estão configuradas.");
        var user = currentUser.require();
        var gender = messages.genderFor(user.getFullName());
        var message = messages.messageFor(user.getFullName(), gender,
                ThreadLocalRandom.current().nextInt(messages.messageCount(gender)));
        var userSubscriptions = subscriptions.findByEnabledTrue().stream()
                .filter(subscription -> subscription.getUser().getId().equals(user.getId()))
                .toList();
        int delivered = (int) userSubscriptions.stream()
                .filter(subscription -> push.send(subscription, "Hora da água 💧", message))
                .count();
        return new TestPushResponse(userSubscriptions.size(), delivered);
    }

    public record TestPushResponse(int attempted, int delivered) {}
}
