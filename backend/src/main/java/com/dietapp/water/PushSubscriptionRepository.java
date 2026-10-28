package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {
    Optional<PushSubscription> findByEndpoint(String endpoint);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select subscription from PushSubscription subscription where subscription.endpoint = :endpoint")
    Optional<PushSubscription> findForUpdateByEndpoint(@Param("endpoint") String endpoint);

    List<PushSubscription> findByEnabledTrue();
    List<PushSubscription> findByUserIdAndEnabledTrue(UUID userId);
}
