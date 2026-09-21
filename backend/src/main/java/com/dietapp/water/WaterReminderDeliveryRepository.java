package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.UUID;

public interface WaterReminderDeliveryRepository extends JpaRepository<WaterReminderDelivery, UUID> {
    boolean existsByUserIdAndReminderDateAndReminderSlot(UUID userId, LocalDate reminderDate, String reminderSlot);
}
