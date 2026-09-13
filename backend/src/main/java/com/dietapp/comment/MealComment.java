package com.dietapp.comment;

import com.dietapp.meal.Meal;
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
@Table(name = "meal_comments")
public class MealComment {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meal_id", nullable = false)
    private Meal meal;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;
    @Column(nullable = false, length = 1000)
    private String content;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MealComment() {}

    public MealComment(Meal meal, User author, String content) {
        this.id = UUID.randomUUID();
        this.meal = meal;
        this.author = author;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
        this.content = content.trim();
    }

    public UUID getId() { return id; }
    public Meal getMeal() { return meal; }
    public User getAuthor() { return author; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void update(String content) {
        this.content = content.trim();
        this.updatedAt = Instant.now();
    }
}
