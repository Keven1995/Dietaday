package com.dietapp.meal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MealRepository extends JpaRepository<Meal, UUID> {
    @EntityGraph(attributePaths = "author")
    @Query("select m from Meal m where m.diet.id = :dietId " +
           "and (:fromDate is null or m.mealDate >= :fromDate) " +
           "and (:toDate is null or m.mealDate <= :toDate) order by m.mealDate desc, m.createdAt desc")
    List<Meal> findHistory(@Param("dietId") UUID dietId, @Param("fromDate") LocalDate fromDate,
                           @Param("toDate") LocalDate toDate);

    @EntityGraph(attributePaths = "author")
    Optional<Meal> findByIdAndDietId(UUID id, UUID dietId);
}
