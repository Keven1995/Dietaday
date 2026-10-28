package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.UUID;

public interface WaterReminderDeliveryRepository extends JpaRepository<WaterReminderDelivery, UUID> {
    boolean existsByUserIdAndReminderDateAndReminderSlot(UUID userId, LocalDate reminderDate, String reminderSlot);

    @Modifying(flushAutomatically = true)
    @Query(value = "DELETE FROM water_reminder_deliveries " +
            "WHERE user_id = :userId AND reminder_date = :date AND reminder_slot = :slot", nativeQuery = true)
    int releaseClaim(@Param("userId") UUID userId, @Param("date") LocalDate date, @Param("slot") String slot);
}
