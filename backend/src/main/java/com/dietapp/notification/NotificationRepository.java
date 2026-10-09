package com.dietapp.notification;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    @Query(value = """
            select n.id as \"id\", n.type as \"type\", n.diet_id as \"dietId\",
                   n.meal_id as \"mealId\", m.meal_date as \"mealDate\", n.comment_id as \"commentId\",
                   n.actor_id as \"actorId\", actor.full_name as \"actorName\", m.meal_type as \"mealType\",
                   cast(null as varchar) as \"messageKey\", n.created_at as \"createdAt\", n.read_at as \"readAt\"
            from notifications n
            join meals m on m.id = n.meal_id
            join app_users actor on actor.id = n.actor_id
            where n.recipient_id = :recipientId
              and exists (select 1 from diet_members member
                          where member.diet_id = n.diet_id and member.user_id = :recipientId)
            union all
            select nudge.id as \"id\", 'MEAL_NUDGED' as \"type\", nudge.diet_id as \"dietId\",
                   cast(null as uuid) as \"mealId\", nudge.meal_date as \"mealDate\",
                   cast(null as uuid) as \"commentId\", nudge.sender_id as \"actorId\",
                   sender.full_name as \"actorName\", nudge.meal_type as \"mealType\",
                   nudge.message_key as \"messageKey\", nudge.created_at as \"createdAt\",
                   nudge.read_at as \"readAt\"
            from meal_nudges nudge
            join app_users sender on sender.id = nudge.sender_id
            where nudge.recipient_id = :recipientId
              and exists (select 1 from diet_members member
                          where member.diet_id = nudge.diet_id and member.user_id = :recipientId)
            order by \"createdAt\" desc, \"id\" desc
            """, countQuery = """
            select
              (select count(n.id) from notifications n
               where n.recipient_id = :recipientId
                 and exists (select 1 from diet_members member
                             where member.diet_id = n.diet_id and member.user_id = :recipientId))
              +
              (select count(nudge.id) from meal_nudges nudge
               where nudge.recipient_id = :recipientId
                 and exists (select 1 from diet_members member
                             where member.diet_id = nudge.diet_id and member.user_id = :recipientId))
            """, nativeQuery = true)
    Page<NotificationFeedProjection> findAccessibleFeed(@Param("recipientId") UUID recipientId, Pageable pageable);

    @EntityGraph(attributePaths = {"diet", "meal", "comment", "actor"})
    @Query("""
            select notification from Notification notification
            where notification.recipient.id = :recipientId
              and exists (select member.id from DietMember member
                          where member.diet.id = notification.diet.id
                            and member.user.id = :recipientId)
            order by notification.createdAt desc
            """)
    Page<Notification> findAccessible(@Param("recipientId") UUID recipientId, Pageable pageable);

    @Query("""
            select notification from Notification notification
            where notification.id = :id and notification.recipient.id = :recipientId
              and exists (select member.id from DietMember member
                          where member.diet.id = notification.diet.id
                            and member.user.id = :recipientId)
            """)
    Optional<Notification> findAccessibleById(@Param("id") UUID id, @Param("recipientId") UUID recipientId);

    @Query("""
            select count(notification) from Notification notification
            where notification.recipient.id = :recipientId and notification.readAt is null
              and exists (select member.id from DietMember member
                          where member.diet.id = notification.diet.id
                            and member.user.id = :recipientId)
            """)
    long countUnreadAccessible(@Param("recipientId") UUID recipientId);

    @Modifying
    @Query(value = "UPDATE notifications n SET read_at = CURRENT_TIMESTAMP " +
            "WHERE n.recipient_id = :recipientId AND n.read_at IS NULL " +
            "AND EXISTS (SELECT 1 FROM diet_members m WHERE m.diet_id = n.diet_id AND m.user_id = :recipientId)",
            nativeQuery = true)
    int markAllUnread(@Param("recipientId") UUID recipientId);

    interface NotificationFeedProjection {
        Object getId();
        String getType();
        Object getDietId();
        Object getMealId();
        Object getMealDate();
        Object getCommentId();
        Object getActorId();
        String getActorName();
        String getMealType();
        String getMessageKey();
        Object getCreatedAt();
        Object getReadAt();
    }
}
