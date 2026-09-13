package com.dietapp.comment;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MealCommentRepository extends JpaRepository<MealComment, UUID> {
    @EntityGraph(attributePaths = {"author", "meal"})
    List<MealComment> findAllByMealIdOrderByCreatedAtAsc(UUID mealId);

    @EntityGraph(attributePaths = {"author", "meal"})
    @Query("select c from MealComment c where c.id = :commentId and c.meal.id = :mealId " +
            "and c.meal.diet.id = :dietId")
    Optional<MealComment> findScoped(@Param("dietId") UUID dietId, @Param("mealId") UUID mealId,
                                     @Param("commentId") UUID commentId);

    @Query("select new com.dietapp.comment.MealCommentCount(c.meal.id, count(c)) " +
            "from MealComment c where c.meal.id in :mealIds group by c.meal.id")
    List<MealCommentCount> countByMealIds(@Param("mealIds") Collection<UUID> mealIds);
}
