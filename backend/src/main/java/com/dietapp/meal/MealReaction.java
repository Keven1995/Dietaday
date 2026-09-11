package com.dietapp.meal;

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
@Table(name = "meal_reactions")
public class MealReaction {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meal_id", nullable = false)
    private Meal meal;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(nullable = false, length = 64)
    private String emoji;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MealReaction() {}

    MealReaction(Meal meal, User user, String emoji) {
        this.id = UUID.randomUUID();
        this.meal = meal;
        this.user = user;
        this.createdAt = Instant.now();
        update(emoji);
    }

    void update(String emoji) {
        this.emoji = emoji;
        this.updatedAt = Instant.now();
    }

    Meal getMeal() { return meal; }
    User getUser() { return user; }
    String getEmoji() { return emoji; }
}
