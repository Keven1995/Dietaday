package com.dietapp.meal;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MealSyncOperationRepository extends JpaRepository<MealSyncOperation, UUID> {
    @Override
    @EntityGraph(attributePaths = {"user", "diet", "meal", "meal.author"})
    Optional<MealSyncOperation> findById(UUID operationId);
}
