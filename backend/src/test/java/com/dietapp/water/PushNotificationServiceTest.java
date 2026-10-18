package com.dietapp.water;

import com.dietapp.security.SecurityAuditService;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import com.fasterxml.jackson.databind.ObjectMapper;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.apache.http.HttpResponse;
import org.apache.http.HttpVersion;
import org.apache.http.message.BasicHttpResponse;
import org.apache.http.entity.StringEntity;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.security.KeyPairGenerator;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PushNotificationServiceTest {
    @Mock private SecurityAuditService audit;
    @Mock private PushServiceFactory pushServiceFactory;
    @Mock private PushService pushService;
    private PushNotificationService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new PushNotificationService(new ObjectMapper(), "public-key", "private-key",
                "mailto:test@example.com", audit, pushServiceFactory);
    }

    @Test
    void sanitizesProviderMessageForLogs() {
        String input = "{\"reason\":\"Invalid JWT Token\"}\nnext line";

        assertThat(PushNotificationService.sanitizeProviderMessage(input))
                .isEqualTo("{\"reason\":\"Invalid JWT Token\"} next line");
    }

    @Test
    void limitsProviderMessageLength() {
        assertThat(PushNotificationService.sanitizeProviderMessage("x".repeat(600))).hasSize(512);
    }

    @ParameterizedTest
    @ValueSource(ints = {404, 410})
    void disablesSubscriptionsForGoneProviderEndpoints(int status) throws Exception {
        PushSubscription subscription = subscription();
        when(pushServiceFactory.create("public-key", "private-key", "mailto:test@example.com"))
                .thenReturn(pushService);
        when(pushService.send(any(Notification.class))).thenReturn(response(status, ""));

        assertThat(service.send(subscription, "Title", "Body")).isFalse();

        assertThat(subscription.isEnabled()).isFalse();
    }

    @Test
    void disablesSubscriptionForVapidKeyMismatch() throws Exception {
        PushSubscription subscription = subscription();
        when(pushServiceFactory.create("public-key", "private-key", "mailto:test@example.com"))
                .thenReturn(pushService);
        when(pushService.send(any(Notification.class)))
                .thenReturn(response(400, "{\"reason\":\"VapidPkHashMismatch\"}"));

        assertThat(service.send(subscription, "Title", "Body")).isFalse();

        assertThat(subscription.isEnabled()).isFalse();
    }

    @Test
    void auditsProviderFailureAndLeavesSubscriptionEnabled() throws Exception {
        PushSubscription subscription = subscription();
        when(pushServiceFactory.create("public-key", "private-key", "mailto:test@example.com"))
                .thenReturn(pushService);
        when(pushService.send(any(Notification.class))).thenReturn(response(503, "temporarily unavailable"));

        assertThat(service.send(subscription, "Title", "Body")).isFalse();

        assertThat(subscription.isEnabled()).isTrue();
        verify(audit).pushFailure(subscription.getId(), 503, "http_error");
    }

    @Test
    void auditsTransportFailureWithoutCallingARealPushProvider() throws Exception {
        PushSubscription subscription = subscription();
        when(pushServiceFactory.create("public-key", "private-key", "mailto:test@example.com"))
                .thenReturn(pushService);
        when(pushService.send(any(Notification.class))).thenThrow(new IOException("network failure"));

        assertThat(service.send(subscription, "Title", "Body")).isFalse();

        assertThat(subscription.isEnabled()).isTrue();
        verify(audit).pushFailure(subscription.getId(), null, "IOException");
    }

    private static PushSubscription subscription() throws Exception {
        User user = new User("push-test@example.com", "password-hash", "Push Test", UserSex.NEUTRAL);
        KeyPairGenerator generator = KeyPairGenerator.getInstance("ECDH", "BC");
        generator.initialize(ECNamedCurveTable.getParameterSpec("prime256v1"));
        byte[] publicKey = Utils.encode((ECPublicKey) generator.generateKeyPair().getPublic());
        String encodedPublicKey = Base64.getUrlEncoder().withoutPadding().encodeToString(publicKey);
        String auth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);
        return new PushSubscription(user, "https://push.example.test/subscription", encodedPublicKey, auth);
    }

    private static HttpResponse response(int status, String body) {
        BasicHttpResponse response = new BasicHttpResponse(HttpVersion.HTTP_1_1, status, "test");
        if (!body.isEmpty()) response.setEntity(new StringEntity(body, StandardCharsets.UTF_8));
        return response;
    }
}
