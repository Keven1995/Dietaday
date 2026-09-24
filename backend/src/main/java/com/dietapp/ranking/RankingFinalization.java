package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.user.User;
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
@Table(name = "ranking_finalizations",
        uniqueConstraints = @UniqueConstraint(name = "uq_ranking_finalization_diet", columnNames = "diet_id"))
public class RankingFinalization {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    private Instant finalizedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "first_user_id")
    private User first;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "second_user_id")
    private User second;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "third_user_id")
    private User third;

    protected RankingFinalization() {}

    public RankingFinalization(Diet diet, Instant finalizedAt, User first, User second, User third) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.finalizedAt = finalizedAt;
        this.first = first;
        this.second = second;
        this.third = third;
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public Instant getFinalizedAt() { return finalizedAt; }
    public User getFirst() { return first; }
    public User getSecond() { return second; }
    public User getThird() { return third; }
}
