package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface WaterCheckRepository extends JpaRepository<WaterCheck, UUID> {
    List<WaterCheck> findByUserIdAndCheckDateOrderByCreatedAtAsc(UUID userId, LocalDate checkDate);
}
