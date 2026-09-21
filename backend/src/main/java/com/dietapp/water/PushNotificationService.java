package com.dietapp.water;

import com.fasterxml.jackson.databind.ObjectMapper;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.jose4j.lang.JoseException;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.security.GeneralSecurityException;
import java.security.Security;
import java.util.Map;

@Service
public class PushNotificationService {
    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    private final ObjectMapper objectMapper;
    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public PushNotificationService(
            ObjectMapper objectMapper,
            @Value("${app.push.public-key:}") String publicKey,
            @Value("${app.push.private-key:}") String privateKey,
            @Value("${app.push.subject:mailto:dev@dietaday.com.br}") String subject) {
        this.objectMapper = objectMapper;
        this.publicKey = publicKey.trim();
        this.privateKey = privateKey.trim();
        this.subject = subject.trim();
        Security.addProvider(new BouncyCastleProvider());
    }

    @PostConstruct
    void logConfiguration() {
        if (!isConfigured()) log.warn("water_push_disabled reason=vapid_not_configured");
    }

    public boolean isConfigured() {
        return !publicKey.isEmpty() && !privateKey.isEmpty();
    }

    public String publicKey() {
        return publicKey;
    }

    public boolean send(PushSubscription subscription, String title, String message) {
        if (!isConfigured()) return false;
        try {
            PushService pushService = new PushService(publicKey, privateKey, subject);
            String payload = objectMapper.writeValueAsString(Map.of(
                    "title", title,
                    "body", message,
                    "url", "/",
                    "tag", "water-reminder"));
            Notification notification = new Notification(
                    subscription.getEndpoint(), subscription.getP256dh(), subscription.getAuth(), payload);
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                subscription.disable();
                return false;
            }
            if (status < 200 || status >= 300) {
                log.warn("water_push_failed subscriptionId={} status={}", subscription.getId(), status);
                return false;
            }
            return true;
        } catch (GeneralSecurityException | JoseException | java.io.IOException
                 | java.util.concurrent.ExecutionException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("water_push_failed subscriptionId={} errorType={}",
                    subscription.getId(), exception.getClass().getSimpleName());
            return false;
        }
    }
}
