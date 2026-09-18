package com.dietapp.upload;

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

    public CloudinaryUploadController(CloudinaryUploadService service) {
        this.service = service;
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
            log.warn("cloudinary_signature_failed durationMs={} errorType={}",
                    System.currentTimeMillis() - startedAt, exception.getClass().getSimpleName());
            throw exception;
        }
    }
}
