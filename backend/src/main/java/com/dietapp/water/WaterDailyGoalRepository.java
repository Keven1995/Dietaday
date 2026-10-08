package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface WaterDailyGoalRepository extends JpaRepository<WaterDailyGoal, UUID> {
    Optional<WaterDailyGoal> findByUserIdAndGoalDateAndDietIsNull(UUID userId, LocalDate goalDate);

    Optional<WaterDailyGoal> findByUserIdAndDietIdAndGoalDate(UUID userId, UUID dietId, LocalDate goalDate);
}
