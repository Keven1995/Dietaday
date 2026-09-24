package com.dietapp.telemetry;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SyncErrorEventRepository extends JpaRepository<SyncErrorEvent, UUID> {
}
