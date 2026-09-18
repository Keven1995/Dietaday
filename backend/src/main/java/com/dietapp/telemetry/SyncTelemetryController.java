package com.dietapp.telemetry;

import com.dietapp.security.CurrentUser;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/telemetry")
public class SyncTelemetryController {
    private static final Logger log = LoggerFactory.getLogger(SyncTelemetryController.class);
    private final CurrentUser currentUser;

    public SyncTelemetryController(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @PostMapping("/sync")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sync(@Valid @RequestBody SyncTelemetryRequest event) {
        log.info("sync_event userId={} operationId={} phase={} attempt={} durationMs={} httpStatus={} fileType={} fileSizeBytes={}",
                currentUser.id(), event.operationId(), event.phase(), event.attempt(), event.durationMs(),
                event.httpStatus(), event.fileType(), event.fileSizeBytes());
    }
}
