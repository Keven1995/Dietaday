package com.dietapp.water;

import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class PushSubscriptionService {
    private static final Logger log = LoggerFactory.getLogger(PushSubscriptionService.class);
    private final PushSubscriptionRepository subscriptions;
    private final CurrentUser currentUser;

    public PushSubscriptionService(PushSubscriptionRepository subscriptions, CurrentUser currentUser) {
        this.subscriptions = subscriptions;
        this.currentUser = currentUser;
    }

    @Transactional
    public void subscribe(PushSubscriptionRequest request) {
        var existing = subscriptions.findByEndpoint(request.endpoint());
        if (existing.isPresent()) {
            PushSubscription subscription = existing.get();
            if (!subscription.getUser().getId().equals(currentUser.id())) {
                subscription.reassignTo(currentUser.require(), request.p256dh(), request.auth());
            } else {
                subscription.updateKeys(request.p256dh(), request.auth());
            }
            log.info("water_push_subscription_saved userId={} refreshed=true", currentUser.id());
            return;
        }
        subscriptions.save(new PushSubscription(currentUser.require(), request.endpoint(), request.p256dh(), request.auth()));
        log.info("water_push_subscription_saved userId={} refreshed=false", currentUser.id());
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        subscriptions.findByEndpoint(endpoint)
                .filter(subscription -> subscription.getUser().getId().equals(currentUser.id()))
                .ifPresent(PushSubscription::disable);
    }
}
