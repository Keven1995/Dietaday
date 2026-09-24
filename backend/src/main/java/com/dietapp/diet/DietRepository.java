package com.dietapp.diet;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface DietRepository extends JpaRepository<Diet, UUID> {
    List<Diet> findAllByCompetitiveModeTrue();

    @Query("select d from Diet d join DietMember m on m.diet = d where m.user.id = :userId order by d.startDate desc")
    Page<Diet> findAllForUser(@Param("userId") UUID userId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Diet d where d.id = :id")
    Optional<Diet> findForUpdateById(@Param("id") UUID id);
}
