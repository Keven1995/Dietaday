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
}
