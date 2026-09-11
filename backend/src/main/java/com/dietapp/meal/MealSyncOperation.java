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
import java.util.UUID;

@Entity
@Table(name = "meal_sync_operations")
public class MealSyncOperation {
    @Id
    @Column(name = "operation_id")
    private UUID operationId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meal_id", nullable = false)
    private Meal meal;
    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;
    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    protected MealSyncOperation() {}

    MealSyncOperation(UUID operationId, User user, Diet diet, Meal meal, String requestHash) {
        this.operationId = operationId;
        this.user = user;
        this.diet = diet;
        this.meal = meal;
        this.requestHash = requestHash;
        this.processedAt = Instant.now();
    }

    User getUser() { return user; }
    Diet getDiet() { return diet; }
    Meal getMeal() { return meal; }
    String getRequestHash() { return requestHash; }
}
