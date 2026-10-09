package com.dietapp.nudge;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MealNudgeRepository extends JpaRepository<MealNudge, UUID> {
    Optional<MealNudge> findByDietIdAndSenderIdAndRecipientIdAndMealDateAndMealType(
            UUID dietId, UUID senderId, UUID recipientId, LocalDate mealDate, MealNudgeType mealType);

    @Query("select n.mealType from MealNudge n where n.diet.id = :dietId and n.sender.id = :senderId " +
            "and n.recipient.id = :recipientId and n.mealDate = :mealDate")
    List<MealNudgeType> findSentTypes(@Param("dietId") UUID dietId, @Param("senderId") UUID senderId,
                                      @Param("recipientId") UUID recipientId,
                                      @Param("mealDate") LocalDate mealDate);

    @Query("select n.recipient.id as recipientId, n.mealType as mealType from MealNudge n " +
            "where n.diet.id = :dietId and n.sender.id = :senderId and n.mealDate = :mealDate")
    List<SentMealNudgeEntry> findSentTypesForDiet(@Param("dietId") UUID dietId,
                                                   @Param("senderId") UUID senderId,
                                                   @Param("mealDate") LocalDate mealDate);

    @EntityGraph(attributePaths = {"diet", "sender", "recipient"})
    @Query("select n from MealNudge n where n.id = :id and n.recipient.id = :recipientId " +
            "and exists (select member.id from DietMember member " +
            "where member.diet.id = n.diet.id and member.user.id = :recipientId)")
    Optional<MealNudge> findAccessibleById(@Param("id") UUID id, @Param("recipientId") UUID recipientId);

    @Query("select count(n) from MealNudge n where n.recipient.id = :recipientId and n.readAt is null " +
            "and exists (select member.id from DietMember member " +
            "where member.diet.id = n.diet.id and member.user.id = :recipientId)")
    long countUnreadAccessible(@Param("recipientId") UUID recipientId);

    @Modifying
    @Query(value = "UPDATE meal_nudges n SET read_at = CURRENT_TIMESTAMP " +
            "WHERE n.recipient_id = :recipientId AND n.read_at IS NULL " +
            "AND EXISTS (SELECT 1 FROM diet_members m WHERE m.diet_id = n.diet_id AND m.user_id = :recipientId)",
            nativeQuery = true)
    int markAllUnread(@Param("recipientId") UUID recipientId);

    interface SentMealNudgeEntry {
        UUID getRecipientId();
        MealNudgeType getMealType();
    }
}
