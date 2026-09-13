package com.dietapp.meal;

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
@Table(name = "meals")
public class Meal {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;
    @Column(name = "meal_type", nullable = false, length = 30)
    private String mealType;
    @Column(nullable = false, length = 1000)
    private String description;
    @Column(name = "meal_date", nullable = false)
    private LocalDate mealDate;
    @Column(name = "photo_url", length = 1000)
    private String photoUrl;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Meal() {}

    public Meal(Diet diet, User author, String mealType, String description, LocalDate mealDate, String photoUrl) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.author = author;
        this.createdAt = Instant.now();
        update(mealType, description, mealDate, photoUrl);
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public User getAuthor() { return author; }
    public String getMealType() { return mealType; }
    public String getDescription() { return description; }
    public LocalDate getMealDate() { return mealDate; }
    public String getPhotoUrl() { return photoUrl; }
    public Instant getCreatedAt() { return createdAt; }

    public void update(String mealType, String description, LocalDate mealDate, String photoUrl) {
        this.mealType = mealType.trim();
        this.description = description.trim();
        this.mealDate = mealDate;
        this.photoUrl = photoUrl == null || photoUrl.isBlank() ? null : photoUrl.trim();
    }
}
