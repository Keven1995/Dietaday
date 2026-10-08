package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaterDailyGoalRepository extends JpaRepository<WaterDailyGoal, UUID> {
    Optional<WaterDailyGoal> findByUserIdAndGoalDateAndDietIsNull(UUID userId, LocalDate goalDate);

    Optional<WaterDailyGoal> findByUserIdAndDietIdAndGoalDate(UUID userId, UUID dietId, LocalDate goalDate);

    List<WaterDailyGoal> findByUserIdAndGoalDateBetweenAndDietIsNull(
            UUID userId, LocalDate startDate, LocalDate endDate);

    List<WaterDailyGoal> findByUserIdAndDietIdAndGoalDateBetween(
            UUID userId, UUID dietId, LocalDate startDate, LocalDate endDate);
}
