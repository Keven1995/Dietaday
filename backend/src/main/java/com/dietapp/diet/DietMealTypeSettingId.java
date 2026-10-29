package com.dietapp.diet;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

public class DietMealTypeSettingId implements Serializable {
    private UUID dietId;
    private LocalDate effectiveFrom;
    private String mealType;

    public DietMealTypeSettingId() {}

    public DietMealTypeSettingId(UUID dietId, LocalDate effectiveFrom, String mealType) {
        this.dietId = dietId;
        this.effectiveFrom = effectiveFrom;
        this.mealType = mealType;
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof DietMealTypeSettingId other)) return false;
        return Objects.equals(dietId, other.dietId)
                && Objects.equals(effectiveFrom, other.effectiveFrom)
                && Objects.equals(mealType, other.mealType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dietId, effectiveFrom, mealType);
    }
}
