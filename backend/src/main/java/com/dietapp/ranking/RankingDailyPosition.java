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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ranking_daily_positions",
        uniqueConstraints = @UniqueConstraint(name = "uq_ranking_daily_position_participant",
                columnNames = {"closure_id", "user_id"}))
public class RankingDailyPosition {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "closure_id", nullable = false)
    private DailyRankingClosure closure;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(nullable = false)
    private int position;
    @Column(nullable = false)
    private int points;
    @Column(name = "active_days", nullable = false)
    private int activeDays;
    @Column(name = "first_reached_at")
    private Instant firstReachedAt;

    protected RankingDailyPosition() {}

    public RankingDailyPosition(DailyRankingClosure closure, User user, int position,
                                int points, int activeDays, Instant firstReachedAt) {
        this.id = UUID.randomUUID();
        this.closure = closure;
        this.user = user;
        this.position = position;
        this.points = points;
        this.activeDays = activeDays;
        this.firstReachedAt = firstReachedAt;
    }

    public UUID getId() { return id; }
    public DailyRankingClosure getClosure() { return closure; }
    public User getUser() { return user; }
    public int getPosition() { return position; }
    public int getPoints() { return points; }
    public int getActiveDays() { return activeDays; }
    public Instant getFirstReachedAt() { return firstReachedAt; }
}
