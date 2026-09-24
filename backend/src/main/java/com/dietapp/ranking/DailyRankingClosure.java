package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ranking_daily_closures",
        uniqueConstraints = @UniqueConstraint(name = "uq_ranking_daily_closure_diet_date",
                columnNames = {"diet_id", "event_date"}))
public class DailyRankingClosure {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;
    @Column(name = "closed_at", nullable = false)
    private Instant closedAt;

    protected DailyRankingClosure() {}

    public DailyRankingClosure(Diet diet, LocalDate eventDate, Instant closedAt) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.eventDate = eventDate;
        this.closedAt = closedAt;
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public LocalDate getEventDate() { return eventDate; }
    public Instant getClosedAt() { return closedAt; }
}
