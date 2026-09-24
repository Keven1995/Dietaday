package com.dietapp.telemetry;

import com.dietapp.diet.Diet;
import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sync_error_events")
public class SyncErrorEvent {
    @Id
    private UUID id;
    @Column(name = "operation_id", nullable = false)
    private UUID operationId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @Column(nullable = false, length = 32)
    private String phase;
    @Column(nullable = false)
    private int attempt;
    @Column(name = "duration_ms")
    private Long durationMs;
    @Column(name = "http_status")
    private Integer httpStatus;
    @Column(name = "error_code", nullable = false, length = 64)
    private String errorCode;
    @Column(name = "file_type", length = 100)
    private String fileType;
    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected SyncErrorEvent() {}

    public SyncErrorEvent(UUID operationId, User user, Diet diet, SyncTelemetryRequest request) {
        this.id = UUID.randomUUID();
        this.operationId = operationId;
        this.user = user;
        this.diet = diet;
        this.phase = request.phase();
        this.attempt = request.attempt();
        this.durationMs = request.durationMs();
        this.httpStatus = request.httpStatus();
        this.errorCode = request.errorType();
        this.fileType = request.fileType();
        this.fileSizeBytes = request.fileSizeBytes();
        this.occurredAt = Instant.now();
    }
}
