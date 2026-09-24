package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ranking_scores",
        uniqueConstraints = @UniqueConstraint(name = "uq_ranking_score_diet_user",
                columnNames = {"diet_id", "user_id"}))
public class RankingScore {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(nullable = false)
    private int points;
    @Column(name = "active_days", nullable = false)
    private int activeDays;
    @Column(name = "first_reached_at")
    private Instant firstReachedAt;
    @Column(name = "initial_order", nullable = false)
    private long initialOrder;

    protected RankingScore() {}

    public RankingScore(Diet diet, User user, long initialOrder) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.user = user;
        this.initialOrder = initialOrder;
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public User getUser() { return user; }
    public int getPoints() { return points; }
    public int getActiveDays() { return activeDays; }
    public Instant getFirstReachedAt() { return firstReachedAt; }
    public long getInitialOrder() { return initialOrder; }

    public void addDailyPoints(int dailyPoints, Instant reachedAt) {
        if (dailyPoints <= 0) return;
        points += dailyPoints;
        activeDays++;
        if (firstReachedAt == null) firstReachedAt = reachedAt;
    }
}
