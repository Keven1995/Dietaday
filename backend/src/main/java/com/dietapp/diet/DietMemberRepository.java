package com.dietapp.diet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DietMemberRepository extends JpaRepository<DietMember, UUID> {
    boolean existsByDietIdAndUserId(UUID dietId, UUID userId);

    @EntityGraph(attributePaths = "diet")
    Optional<DietMember> findByDietIdAndUserId(UUID dietId, UUID userId);
    @EntityGraph(attributePaths = "user")
    Page<DietMember> findAllByDietId(UUID dietId, Pageable pageable);

    long countByDietId(UUID dietId);

    List<DietMember> findAllByDietId(UUID dietId);
}
