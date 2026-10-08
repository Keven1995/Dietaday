package com.dietapp.water;

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
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "water_daily_goals")
public class WaterDailyGoal {
    static final UUID GENERAL_SCOPE_KEY = new UUID(0L, 0L);

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diet_id")
    private Diet diet;

    @Column(name = "scope_key", nullable = false)
    private UUID scopeKey;

    @Column(name = "goal_date", nullable = false)
    private LocalDate goalDate;

    @Column(name = "goal_ml", nullable = false)
    private int goalMl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WaterDailyGoal() {}

    public WaterDailyGoal(User user, Diet diet, LocalDate goalDate, int goalMl) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.diet = diet;
        this.scopeKey = diet == null ? GENERAL_SCOPE_KEY : diet.getId();
        this.goalDate = goalDate;
        this.goalMl = goalMl;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public Diet getDiet() { return diet; }
    public UUID getScopeKey() { return scopeKey; }
    public LocalDate getGoalDate() { return goalDate; }
    public int getGoalMl() { return goalMl; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void updateGoalMl(int goalMl) {
        this.goalMl = goalMl;
        this.updatedAt = Instant.now();
    }
}
