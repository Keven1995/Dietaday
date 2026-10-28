package com.dietapp.diet;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "diets")
public class Diet {
    @Id
    private UUID id;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;
    @Column(name = "competitive_mode", nullable = false)
    private boolean competitiveMode;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "creation_operation_id")
    private UUID creationOperationId;
    @Column(name = "creation_request_hash", length = 64)
    private String creationRequestHash;

    protected Diet() {}

    public Diet(String name, LocalDate startDate, LocalDate endDate, boolean competitiveMode) {
        this(name, startDate, endDate, competitiveMode, null, null);
    }

    public Diet(String name, LocalDate startDate, LocalDate endDate, boolean competitiveMode,
                UUID creationOperationId, String creationRequestHash) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        this.competitiveMode = competitiveMode;
        this.createdAt = Instant.now();
        this.creationOperationId = creationOperationId;
        this.creationRequestHash = creationRequestHash;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public boolean isCompetitiveMode() { return competitiveMode; }
    public UUID getCreationOperationId() { return creationOperationId; }
    public String getCreationRequestHash() { return creationRequestHash; }

    public void update(String name, LocalDate startDate, LocalDate endDate) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
    }
}
