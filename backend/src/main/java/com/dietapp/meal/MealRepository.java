package com.dietapp.meal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface MealRepository extends JpaRepository<Meal, UUID> {
    @EntityGraph(attributePaths = "author")
    @Query("select m from Meal m where m.diet.id = :dietId " +
           "and (:fromDate is null or m.mealDate >= :fromDate) " +
           "and (:toDate is null or m.mealDate <= :toDate) order by m.mealDate desc, m.createdAt desc")
    Page<Meal> findHistory(@Param("dietId") UUID dietId, @Param("fromDate") LocalDate fromDate,
                           @Param("toDate") LocalDate toDate, Pageable pageable);

    @EntityGraph(attributePaths = "author")
    Optional<Meal> findByIdAndDietId(UUID id, UUID dietId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "author")
    @Query("select m from Meal m where m.id = :id and m.diet.id = :dietId")
    Optional<Meal> findForUpdateByIdAndDietId(@Param("id") UUID id, @Param("dietId") UUID dietId);
}
