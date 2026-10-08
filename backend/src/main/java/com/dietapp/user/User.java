package com.dietapp.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class User {
    @Id
    private UUID id;
    @Column(nullable = false, unique = true, length = 255)
    private String email;
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;
    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;
    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;
    @Column(name = "height_cm")
    private Integer heightCm;
    @Column(name = "birth_date")
    private LocalDate birthDate;
    @Enumerated(EnumType.STRING)
    @Column(name = "water_goal_suggestion_review_status", nullable = false, length = 20)
    private WaterGoalSuggestionReviewStatus waterGoalSuggestionReviewStatus = WaterGoalSuggestionReviewStatus.NOT_REQUIRED;
    @Column(name = "daily_water_goal_ml", nullable = false)
    private int dailyWaterGoalMl;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserSex sex;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    protected User() {}

    public User(String email, String passwordHash, String fullName, UserSex sex) {
        this(email, passwordHash, fullName, sex, null);
    }

    public User(String email, String passwordHash, String fullName, UserSex sex, LocalDate birthDate) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.dailyWaterGoalMl = 2000;
        this.sex = sex;
        this.birthDate = birthDate;
        this.createdAt = Instant.now();
        this.emailVerified = false;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public BigDecimal getWeightKg() { return weightKg; }
    public Integer getHeightCm() { return heightCm; }
    public LocalDate getBirthDate() { return birthDate; }
    public WaterGoalSuggestionReviewStatus getWaterGoalSuggestionReviewStatus() { return waterGoalSuggestionReviewStatus; }
    public int getDailyWaterGoalMl() { return dailyWaterGoalMl; }
    public UserSex getSex() { return sex; }
    public boolean isEmailVerified() { return emailVerified; }

    public void verifyEmail() { this.emailVerified = true; }
    public void updatePassword(String passwordHash) { this.passwordHash = passwordHash; }

    public void updateProfile(String fullName, BigDecimal weightKg, Integer heightCm, UserSex sex, LocalDate birthDate) {
        this.fullName = fullName;
        this.weightKg = weightKg;
        this.heightCm = heightCm;
        if (sex != null) this.sex = sex;
        // Older clients omit this field; do not erase a date already saved by a newer client.
        if (birthDate != null) this.birthDate = birthDate;
    }

    public void updateDailyWaterGoal(int dailyWaterGoalMl) {
        this.dailyWaterGoalMl = dailyWaterGoalMl;
    }

    public void markWaterGoalSuggestionReviewPending() {
        this.waterGoalSuggestionReviewStatus = WaterGoalSuggestionReviewStatus.PENDING;
    }

    public void resolveWaterGoalSuggestionReview() {
        this.waterGoalSuggestionReviewStatus = WaterGoalSuggestionReviewStatus.RESOLVED;
    }
}
