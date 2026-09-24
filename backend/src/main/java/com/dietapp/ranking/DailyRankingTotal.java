package com.dietapp.ranking;

import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(name = "ranking_daily_totals",
        uniqueConstraints = @UniqueConstraint(name = "uq_ranking_daily_total_participant",
                columnNames = {"closure_id", "user_id"}))
public class DailyRankingTotal {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "closure_id", nullable = false)
    private DailyRankingClosure closure;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(name = "meal_count", nullable = false)
    private int mealCount;
    @Column(name = "water_check_count", nullable = false)
    private int waterCheckCount;
    @Column(nullable = false)
    private int points;

    protected DailyRankingTotal() {}

    public DailyRankingTotal(DailyRankingClosure closure, User user, int mealCount,
                             int waterCheckCount, int points) {
        this.id = UUID.randomUUID();
        this.closure = closure;
        this.user = user;
        this.mealCount = mealCount;
        this.waterCheckCount = waterCheckCount;
        this.points = points;
    }

    public UUID getId() { return id; }
    public DailyRankingClosure getClosure() { return closure; }
    public User getUser() { return user; }
    public int getMealCount() { return mealCount; }
    public int getWaterCheckCount() { return waterCheckCount; }
    public int getPoints() { return points; }
}
