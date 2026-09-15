package com.dietapp.upload;

import com.dietapp.common.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class CloudinaryUploadService {
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    public CloudinaryUploadService(
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            @Value("${app.cloudinary.api-key:}") String apiKey,
            @Value("${app.cloudinary.api-secret:}") String apiSecret) {
        this.cloudName = cloudName.trim();
        this.apiKey = apiKey.trim();
        this.apiSecret = apiSecret.trim();
    }

    public CloudinarySignatureResponse signature() {
        if (cloudName.isEmpty() || apiKey.isEmpty() || apiSecret.isEmpty()) {
            throw new BadRequestException("O upload de fotos não está configurado no servidor.");
        }
        long timestamp = Instant.now().getEpochSecond();
        String signature = sha1("timestamp=" + timestamp + apiSecret);
        return new CloudinarySignatureResponse(
                cloudName,
                apiKey,
                timestamp,
                signature,
                "https://api.cloudinary.com/v1_1/" + cloudName + "/image/upload");
    }

    private String sha1(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Não foi possível preparar o upload de fotos.", exception);
        }
    }
}
