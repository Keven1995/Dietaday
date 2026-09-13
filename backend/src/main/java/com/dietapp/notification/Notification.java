package com.dietapp.notification;

import com.dietapp.comment.MealComment;
import com.dietapp.diet.Diet;
import com.dietapp.meal.Meal;
import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification {
    public enum Type { MEAL_COMMENTED }

    @Id
    private UUID id;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Type type;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meal_id", nullable = false)
    private Meal meal;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comment_id", nullable = false)
    private MealComment comment;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "read_at")
    private Instant readAt;

    protected Notification() {}

    public Notification(Diet diet, Meal meal, MealComment comment, User recipient, User actor) {
        this.id = UUID.randomUUID();
        this.type = Type.MEAL_COMMENTED;
        this.diet = diet;
        this.meal = meal;
        this.comment = comment;
        this.recipient = recipient;
        this.actor = actor;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Type getType() { return type; }
    public Diet getDiet() { return diet; }
    public Meal getMeal() { return meal; }
    public MealComment getComment() { return comment; }
    public User getActor() { return actor; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }

    public void markRead() {
        if (readAt == null) readAt = Instant.now();
    }
}
