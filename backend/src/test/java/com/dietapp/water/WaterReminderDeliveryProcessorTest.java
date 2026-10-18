package com.dietapp.water;

import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import com.dietapp.user.UserSex;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.apache.http.HttpResponse;
import org.apache.http.HttpVersion;
import org.apache.http.entity.StringEntity;
import org.apache.http.message.BasicHttpResponse;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "app.push.public-key=test-public-key",
        "app.push.private-key=test-private-key"
})
@ActiveProfiles("test")
class WaterReminderDeliveryProcessorTest {
    private static final Instant REMINDER_INSTANT = Instant.parse("2026-10-18T12:00:30Z");
    private static final LocalDate REMINDER_DATE = LocalDate.of(2026, 10, 18);
    private static final String REMINDER_SLOT = "09:00";

    @Autowired private WaterReminderDeliveryProcessor processor;
    @Autowired private UserRepository users;
    @Autowired private PushSubscriptionRepository subscriptions;
    @Autowired private WaterReminderDeliveryRepository deliveries;
    @MockBean private PushServiceFactory pushServiceFactory;

    @BeforeEach
    void resetPushFactory() {
        reset(pushServiceFactory);
    }

    @Test
    void recordsSuccessfulDeliveryAndSkipsSubsequentDuplicatePushes() throws Exception {
        User user = createUser();
        subscriptions.saveAndFlush(createSubscription(user));
        PushService pushService = mockPushService(response(201, ""));

        processor.sendDueReminders(REMINDER_INSTANT, REMINDER_SLOT);
        processor.sendDueReminders(REMINDER_INSTANT, REMINDER_SLOT);

        assertThat(deliveries.existsByUserIdAndReminderDateAndReminderSlot(
                user.getId(), REMINDER_DATE, REMINDER_SLOT)).isTrue();
        verify(pushService, times(1)).send(any(Notification.class));
    }

    @ParameterizedTest
    @MethodSource("terminalPushFailures")
    void persistsDisabledStateForInvalidSubscriptions(int status, String providerMessage) throws Exception {
        User user = createUser();
        PushSubscription subscription = subscriptions.saveAndFlush(createSubscription(user));
        mockPushService(response(status, providerMessage));

        processor.sendDueReminders(REMINDER_INSTANT, REMINDER_SLOT);

        assertThat(subscriptions.findByEndpoint(subscription.getEndpoint()).orElseThrow().isEnabled()).isFalse();
        assertThat(deliveries.existsByUserIdAndReminderDateAndReminderSlot(
                user.getId(), REMINDER_DATE, REMINDER_SLOT)).isFalse();
    }

    @Test
    void leavesSubscriptionEnabledAndDoesNotRecordDeliveryForRetryableProviderFailure() throws Exception {
        User user = createUser();
        PushSubscription subscription = subscriptions.saveAndFlush(createSubscription(user));
        mockPushService(response(503, "temporarily unavailable"));

        processor.sendDueReminders(REMINDER_INSTANT, REMINDER_SLOT);

        assertThat(subscriptions.findByEndpoint(subscription.getEndpoint()).orElseThrow().isEnabled()).isTrue();
        assertThat(deliveries.existsByUserIdAndReminderDateAndReminderSlot(
                user.getId(), REMINDER_DATE, REMINDER_SLOT)).isFalse();
    }

    @Test
    void doesNothingForUsersWithoutEnabledSubscriptions() throws Exception {
        User user = createUser();
        PushSubscription subscription = createSubscription(user);
        subscription.disable();
        subscriptions.saveAndFlush(subscription);

        processor.sendDueReminders(REMINDER_INSTANT, REMINDER_SLOT);

        verifyNoInteractions(pushServiceFactory);
        assertThat(deliveries.existsByUserIdAndReminderDateAndReminderSlot(
                user.getId(), REMINDER_DATE, REMINDER_SLOT)).isFalse();
    }

    private PushService mockPushService(HttpResponse response) throws Exception {
        PushService pushService = mock(PushService.class);
        when(pushServiceFactory.create(anyString(), anyString(), anyString())).thenReturn(pushService);
        when(pushService.send(any(Notification.class))).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            return response;
        });
        return pushService;
    }

    private User createUser() {
        return users.saveAndFlush(new User("water-reminder-" + UUID.randomUUID() + "@example.test",
                "password-hash", "Reminder User", UserSex.NEUTRAL));
    }

    private PushSubscription createSubscription(User user) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("ECDH", "BC");
        generator.initialize(ECNamedCurveTable.getParameterSpec("prime256v1"));
        String publicKey = Base64.getUrlEncoder().withoutPadding().encodeToString(
                Utils.encode((ECPublicKey) generator.generateKeyPair().getPublic()));
        String auth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);
        return new PushSubscription(user, "https://push.example.test/" + UUID.randomUUID(), publicKey, auth);
    }

    private static HttpResponse response(int status, String body) {
        BasicHttpResponse response = new BasicHttpResponse(HttpVersion.HTTP_1_1, status, "test");
        if (!body.isEmpty()) response.setEntity(new StringEntity(body, StandardCharsets.UTF_8));
        return response;
    }

    private static Stream<Arguments> terminalPushFailures() {
        return Stream.of(
                Arguments.of(404, ""),
                Arguments.of(410, ""),
                Arguments.of(400, "{\"reason\":\"VapidPkHashMismatch\"}"));
    }
}
