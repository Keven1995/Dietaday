package com.dietapp.upload;

import com.dietapp.common.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;

@Component
public class PhotoUrlPolicy {
    private static final String CLOUDINARY_HOST = "res.cloudinary.com";
    private final String cloudName;

    public PhotoUrlPolicy(@Value("${app.cloudinary.cloud-name:}") String cloudName) {
        this.cloudName = cloudName.trim();
    }

    public void validate(String photoUrl) {
        if (photoUrl == null || photoUrl.isBlank()) {
            return;
        }

        if (photoUrl.length() > 1000) {
            throw new BadRequestException("A URL da foto excede o limite permitido.");
        }
        if (cloudName.isEmpty()) {
            throw new BadRequestException("O upload de fotos não está configurado no servidor.");
        }

        try {
            URI uri = new URI(photoUrl.trim());
            String expectedPrefix = "/" + cloudName + "/image/upload/";
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !CLOUDINARY_HOST.equalsIgnoreCase(uri.getHost())
                    || uri.getPort() != -1
                    || uri.getUserInfo() != null
                    || !uri.getPath().startsWith(expectedPrefix)) {
                throw new BadRequestException("A foto deve ser armazenada no Cloudinary.");
            }
        } catch (URISyntaxException exception) {
            throw new BadRequestException("A URL da foto é inválida.");
        }
    }
}
