package com.dietapp.water;

import nl.martijndwars.webpush.PushService;
import org.springframework.stereotype.Component;

import java.security.GeneralSecurityException;

@Component
public class PushServiceFactory {
    public PushService create(String publicKey, String privateKey, String subject)
            throws GeneralSecurityException {
        return new PushService(publicKey, privateKey, subject);
    }
}
