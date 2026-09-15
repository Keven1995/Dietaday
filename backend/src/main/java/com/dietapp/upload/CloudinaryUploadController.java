package com.dietapp.upload;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/uploads")
public class CloudinaryUploadController {
    private final CloudinaryUploadService service;

    public CloudinaryUploadController(CloudinaryUploadService service) {
        this.service = service;
    }

    @PostMapping("/signature")
    public CloudinarySignatureResponse signature() {
        return service.signature();
    }
}
