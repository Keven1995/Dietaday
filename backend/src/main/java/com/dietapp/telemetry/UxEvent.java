package com.dietapp.telemetry;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ux_events")
public class UxEvent {
    @Id
    private UUID id;
    @Column(name = "event_id", nullable = false, length = 128)
    private String eventId;
    @Column(name = "event_name", nullable = false, length = 64)
    private String eventName;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(name = "diet_id", nullable = false)
    private UUID dietId;
    @Column(nullable = false, length = 2000)
    private String details;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected UxEvent() {}

    public UxEvent(String eventId, String eventName, UUID userId, UUID dietId, String details) {
        this.id = UUID.randomUUID();
        this.eventId = eventId;
        this.eventName = eventName;
        this.userId = userId;
        this.dietId = dietId;
        this.details = details;
        this.occurredAt = Instant.now();
    }
}
