package com.dietapp.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
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
    @Column(name = "daily_water_goal_ml", nullable = false)
    private int dailyWaterGoalMl;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected User() {}

    public User(String email, String passwordHash, String fullName) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.dailyWaterGoalMl = 2000;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public BigDecimal getWeightKg() { return weightKg; }
    public Integer getHeightCm() { return heightCm; }
    public int getDailyWaterGoalMl() { return dailyWaterGoalMl; }

    public void updateProfile(String fullName, BigDecimal weightKg, Integer heightCm) {
        this.fullName = fullName;
        this.weightKg = weightKg;
        this.heightCm = heightCm;
    }

    public void updateDailyWaterGoal(int dailyWaterGoalMl) {
        this.dailyWaterGoalMl = dailyWaterGoalMl;
    }
}
