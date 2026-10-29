package com.dietapp.diet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

public interface DietMemberRepository extends JpaRepository<DietMember, UUID> {
    boolean existsByDietIdAndUserId(UUID dietId, UUID userId);

    @EntityGraph(attributePaths = "diet")
    Optional<DietMember> findByDietIdAndUserId(UUID dietId, UUID userId);
    @EntityGraph(attributePaths = "user")
    Page<DietMember> findAllByDietId(UUID dietId, Pageable pageable);

    long countByDietId(UUID dietId);

    @EntityGraph(attributePaths = "user")
    List<DietMember> findAllByDietId(UUID dietId);

    @Query("select m.diet.id from DietMember m where m.user.id = :userId " +
            "and m.role = :role and m.diet.id in :dietIds")
    List<UUID> findOwnedDietIds(@Param("userId") UUID userId, @Param("role") DietMember.Role role,
                                @Param("dietIds") Collection<UUID> dietIds);
}
