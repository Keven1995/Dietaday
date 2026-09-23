package com.dietapp.upload;

import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/uploads")
public class CloudinaryUploadController {
    private static final Logger log = LoggerFactory.getLogger(CloudinaryUploadController.class);
    private final CloudinaryUploadService service;
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;

    public CloudinaryUploadController(CloudinaryUploadService service, CurrentUser currentUser,
                                      SecurityAuditService audit) {
        this.service = service;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @PostMapping("/signature")
    public CloudinarySignatureResponse signature() {
        long startedAt = System.currentTimeMillis();
        log.info("cloudinary_signature_started");
        try {
            CloudinarySignatureResponse response = service.signature();
            log.info("cloudinary_signature_completed durationMs={}", System.currentTimeMillis() - startedAt);
            return response;
        } catch (RuntimeException exception) {
            audit.uploadFailure(currentUser.id(), exception.getClass().getSimpleName());
            log.warn("cloudinary_signature_failed durationMs={} errorType={}",
                    System.currentTimeMillis() - startedAt, exception.getClass().getSimpleName());
            throw exception;
        }
    }
}
