package com.dietapp.meal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MealReactionRepository extends JpaRepository<MealReaction, UUID> {
    Optional<MealReaction> findByMealIdAndUserId(UUID mealId, UUID userId);

    @Query("select new com.dietapp.meal.MealReactionCount(r.meal.id, r.emoji, count(r), " +
            "sum(case when r.user.id = :userId then 1 else 0 end)) " +
            "from MealReaction r where r.meal.id in :mealIds group by r.meal.id, r.emoji")
    List<MealReactionCount> summarize(@Param("mealIds") Collection<UUID> mealIds,
                                      @Param("userId") UUID userId);
}
