package com.dietapp.ranking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface DailyRankingClosureRepository extends JpaRepository<DailyRankingClosure, UUID> {
    Optional<DailyRankingClosure> findByDietIdAndEventDate(UUID dietId, LocalDate eventDate);

    Optional<DailyRankingClosure> findTopByDietIdOrderByEventDateDesc(UUID dietId);
}
