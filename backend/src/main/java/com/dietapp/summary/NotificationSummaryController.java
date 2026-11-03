package com.dietapp.summary;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationSummaryController {
    private final NotificationSummaryService service;

    public NotificationSummaryController(NotificationSummaryService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public NotificationSummaryResponse summary() {
        return service.summary();
    }
}
