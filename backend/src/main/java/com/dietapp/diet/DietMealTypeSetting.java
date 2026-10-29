package com.dietapp.diet;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "diet_meal_type_settings")
@IdClass(DietMealTypeSettingId.class)
public class DietMealTypeSetting {
    @Id
    @Column(name = "diet_id", nullable = false)
    private UUID dietId;

    @Id
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Id
    @Column(name = "meal_type", nullable = false, length = 30)
    private String mealType;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    protected DietMealTypeSetting() {}

    public DietMealTypeSetting(UUID dietId, LocalDate effectiveFrom, String mealType,
                               Instant updatedAt, UUID updatedBy) {
        this.dietId = dietId;
        this.effectiveFrom = effectiveFrom;
        this.mealType = mealType;
        this.updatedAt = updatedAt;
        this.updatedBy = updatedBy;
    }

    public UUID getDietId() { return dietId; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public String getMealType() { return mealType; }
}
