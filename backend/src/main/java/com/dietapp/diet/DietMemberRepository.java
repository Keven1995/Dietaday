package com.dietapp.diet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DietMemberRepository extends JpaRepository<DietMember, UUID> {
    boolean existsByDietIdAndUserId(UUID dietId, UUID userId);

    @EntityGraph(attributePaths = "diet")
    Optional<DietMember> findByDietIdAndUserId(UUID dietId, UUID userId);
    @EntityGraph(attributePaths = "user")
    List<DietMember> findAllByDietId(UUID dietId);
}
