package com.dietapp.telemetry;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UxEventRepository extends JpaRepository<UxEvent, UUID> {
    boolean existsByEventIdAndUserId(String eventId, UUID userId);
}
