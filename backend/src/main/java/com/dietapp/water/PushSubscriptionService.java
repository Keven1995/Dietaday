package com.dietapp.water;

import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PushSubscriptionService {
    private static final Logger log = LoggerFactory.getLogger(PushSubscriptionService.class);
    private final PushSubscriptionRepository subscriptions;
    private final CurrentUser currentUser;
    private final TransactionTemplate writeTransaction;

    public PushSubscriptionService(PushSubscriptionRepository subscriptions, CurrentUser currentUser,
                                   PlatformTransactionManager transactionManager) {
        this.subscriptions = subscriptions;
        this.currentUser = currentUser;
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.writeTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void subscribe(PushSubscriptionRequest request) {
        try {
            writeTransaction.executeWithoutResult(status -> upsert(request));
        } catch (DataIntegrityViolationException concurrentInsert) {
            // The unique endpoint key elected another insert; re-read and apply the same upsert.
            writeTransaction.executeWithoutResult(status -> updateExisting(request));
        }
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        subscriptions.findForUpdateByEndpoint(endpoint)
                .filter(subscription -> subscription.getUser().getId().equals(currentUser.id()))
                .ifPresent(PushSubscription::disable);
    }

    private void upsert(PushSubscriptionRequest request) {
        var existing = subscriptions.findForUpdateByEndpoint(request.endpoint());
        if (existing.isPresent()) {
            update(existing.get(), request);
            return;
        }
        subscriptions.saveAndFlush(new PushSubscription(
                currentUser.require(), request.endpoint(), request.p256dh(), request.auth()));
        log.info("water_push_subscription_saved userId={} refreshed=false", currentUser.id());
    }

    private void updateExisting(PushSubscriptionRequest request) {
        PushSubscription subscription = subscriptions.findForUpdateByEndpoint(request.endpoint()).orElseThrow();
        update(subscription, request);
    }

    private void update(PushSubscription subscription, PushSubscriptionRequest request) {
        if (!subscription.getUser().getId().equals(currentUser.id())) {
            subscription.reassignTo(currentUser.require(), request.p256dh(), request.auth());
        } else {
            subscription.updateKeys(request.p256dh(), request.auth());
        }
        log.info("water_push_subscription_saved userId={} refreshed=true", currentUser.id());
    }
}
