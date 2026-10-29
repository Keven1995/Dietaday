package com.dietapp.diet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface DietMealTypeSettingRepository extends JpaRepository<DietMealTypeSetting, DietMealTypeSettingId> {
    List<DietMealTypeSetting> findAllByDietIdOrderByEffectiveFromAscMealTypeAsc(java.util.UUID dietId);

    List<DietMealTypeSetting> findAllByDietIdAndEffectiveFromGreaterThanEqual(
            java.util.UUID dietId, LocalDate effectiveFrom);

    List<DietMealTypeSetting> findAllByDietIdInOrderByDietIdAscEffectiveFromAscMealTypeAsc(
            Collection<java.util.UUID> dietIds);
}
