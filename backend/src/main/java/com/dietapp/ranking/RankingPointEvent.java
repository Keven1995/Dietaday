package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.user.User;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ranking_point_events")
public class RankingPointEvent {
    public enum SourceType { MEAL, WATER_CHECK }
    public enum Status { PENDING, SETTLED, REVOKED }

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 40)
    private SourceType sourceType;
    @Column(name = "source_id", nullable = false)
    private UUID sourceId;
    @Column(name = "meal_type", length = 30)
    private String mealType;
    @Column(name = "water_goal_ml")
    private Integer waterGoalMl;
    @Column(nullable = false)
    private int points;
    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "settled_at")
    private Instant settledAt;

    protected RankingPointEvent() {}

    public RankingPointEvent(Diet diet, User user, SourceType sourceType, UUID sourceId,
                             String mealType, int points, LocalDate eventDate) {
        this(diet, user, sourceType, sourceId, mealType, null, points, eventDate);
    }

    public RankingPointEvent(Diet diet, User user, SourceType sourceType, UUID sourceId,
                             String mealType, Integer waterGoalMl, int points, LocalDate eventDate) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.user = user;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.mealType = mealType;
        this.waterGoalMl = waterGoalMl;
        this.points = points;
        this.eventDate = eventDate;
        this.status = Status.PENDING;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public User getUser() { return user; }
    public SourceType getSourceType() { return sourceType; }
    public UUID getSourceId() { return sourceId; }
    public String getMealType() { return mealType; }
    public Integer getWaterGoalMl() { return waterGoalMl; }
    public int getPoints() { return points; }
    public LocalDate getEventDate() { return eventDate; }
    public Status getStatus() { return status; }
    public void revoke() { status = Status.REVOKED; }
    public void settle(Instant at) { status = Status.SETTLED; settledAt = at; }
}
