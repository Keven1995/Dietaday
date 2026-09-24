package com.dietapp.ranking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface RankingPointEventRepository extends JpaRepository<RankingPointEvent, UUID> {
    Optional<RankingPointEvent> findBySourceTypeAndSourceId(RankingPointEvent.SourceType sourceType, UUID sourceId);

    List<RankingPointEvent> findAllByDietIdAndEventDateAndStatus(
            UUID dietId, LocalDate eventDate, RankingPointEvent.Status status);

    long countByDietIdAndUserId(UUID dietId, UUID userId);

    boolean existsByDietIdAndUserIdAndEventDateAndMealTypeAndSourceTypeAndStatusNot(
            UUID dietId, UUID userId, LocalDate eventDate, String mealType,
            RankingPointEvent.SourceType sourceType, RankingPointEvent.Status status);

    @Modifying
    @Query("update RankingPointEvent event set event.status = com.dietapp.ranking.RankingPointEvent$Status.REVOKED " +
            "where event.sourceType = com.dietapp.ranking.RankingPointEvent$SourceType.MEAL and event.sourceId = :sourceId " +
            "and event.status <> com.dietapp.ranking.RankingPointEvent$Status.REVOKED")
    int revokeMeal(@Param("sourceId") UUID sourceId);

    @Query("select event.user.id as userId, event.user.fullName as fullName, " +
            "coalesce(sum(event.points), 0) as points, count(distinct event.eventDate) as activeDays " +
            "from RankingPointEvent event " +
            "where event.diet.id = :dietId and event.status <> com.dietapp.ranking.RankingPointEvent$Status.REVOKED " +
            "group by event.user.id, event.user.fullName " +
            "order by sum(event.points) desc, count(distinct event.eventDate) desc, event.user.fullName asc")
    Page<RankingRow> findRanking(@Param("dietId") UUID dietId, Pageable pageable);

    interface RankingRow {
        UUID getUserId();
        String getFullName();
        Integer getPoints();
        Long getActiveDays();
    }
}
