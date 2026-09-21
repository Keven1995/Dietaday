package com.dietapp.water;

import com.dietapp.common.BadRequestException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/push")
public class PushPublicKeyController {
    private final PushNotificationService push;

    public PushPublicKeyController(PushNotificationService push) {
        this.push = push;
    }

    @GetMapping("/public-key")
    public PushPublicKeyResponse publicKey() {
        if (!push.isConfigured()) throw new BadRequestException("Notificações não estão configuradas.");
        return new PushPublicKeyResponse(push.publicKey());
    }

    public record PushPublicKeyResponse(String publicKey) {}
}
