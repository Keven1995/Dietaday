package com.dietapp.water;

import com.dietapp.security.SecurityAuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.PushService;
import org.jose4j.lang.JoseException;
import org.apache.http.HttpResponse;
import org.apache.http.Header;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.util.EntityUtils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.security.GeneralSecurityException;
import java.security.Security;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
public class PushNotificationService {
    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    private final ObjectMapper objectMapper;
    private final String publicKey;
    private final String privateKey;
    private final String subject;
    private final SecurityAuditService audit;

    public PushNotificationService(
            ObjectMapper objectMapper,
            @Value("${app.push.public-key:}") String publicKey,
            @Value("${app.push.private-key:}") String privateKey,
            @Value("${app.push.subject:mailto:dev@dietaday.com.br}") String subject,
            SecurityAuditService audit) {
        this.objectMapper = objectMapper;
        this.publicKey = publicKey.trim();
        this.privateKey = privateKey.trim();
        this.subject = subject.trim();
        this.audit = audit;
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
        return send(subscription, title, message, "/", "water-reminder");
    }

    public boolean send(PushSubscription subscription, String title, String message,
                        String url, String tag) {
        if (!isConfigured()) return false;
        try {
            PushService pushService = new FcmCompatiblePushService(publicKey, privateKey, subject);
            String payload = objectMapper.writeValueAsString(Map.of(
                    "title", title,
                    "body", message,
                    "url", url,
                    "tag", tag));
            Notification notification = new Notification(
                    subscription.getEndpoint(), subscription.getP256dh(), subscription.getAuth(), payload);
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();
            String providerMessage = readProviderMessage(response);
            if (status == 404 || status == 410 ||
                    (status == 400 && providerMessage.contains("VapidPkHashMismatch"))) {
                subscription.disable();
                return false;
            }
            if (status < 200 || status >= 300) {
                audit.pushFailure(subscription.getId(), status, "http_error");
                if (providerMessage.isEmpty()) {
                    log.warn("push_notification_failed subscriptionId={} status={}", subscription.getId(), status);
                } else {
                    log.warn("push_notification_failed subscriptionId={} status={} providerMessage={}",
                            subscription.getId(), status, providerMessage);
                }
                return false;
            }
            return true;
        } catch (GeneralSecurityException | JoseException | java.io.IOException
                 | java.util.concurrent.ExecutionException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            audit.pushFailure(subscription.getId(), null, exception.getClass().getSimpleName());
            log.warn("push_notification_failed subscriptionId={} errorType={}",
                    subscription.getId(), exception.getClass().getSimpleName());
            return false;
        }
    }

    private String readProviderMessage(HttpResponse response) {
        if (response.getEntity() == null) return "";
        try {
            return sanitizeProviderMessage(EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8));
        } catch (java.io.IOException exception) {
            return "";
        }
    }

    static String sanitizeProviderMessage(String value) {
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        if (normalized.length() > 512) normalized = normalized.substring(0, 512);
        return normalized;
    }

    static String toFcmCompatibleCryptoKey(String value) {
        String[] parts = value.split(";", -1);
        for (int index = 0; index < parts.length; index++) {
            String part = parts[index].trim();
            if (part.startsWith("p256ecdsa=")) return part;
        }
        return String.join(";", parts);
    }

    private static final class FcmCompatiblePushService extends PushService {
        private FcmCompatiblePushService(String publicKey, String privateKey, String subject)
                throws GeneralSecurityException {
            super(publicKey, privateKey, subject);
        }

        @Override
        public HttpPost preparePost(Notification notification, Encoding encoding)
                throws GeneralSecurityException, java.io.IOException, JoseException {
            HttpPost request = super.preparePost(notification, encoding);
            if (!request.getURI().getHost().equals("fcm.googleapis.com")) return request;
            Header cryptoKey = request.getFirstHeader("Crypto-Key");
            if (cryptoKey != null) request.setHeader("Crypto-Key", toFcmCompatibleCryptoKey(cryptoKey.getValue()));
            return request;
        }
    }
}
