package com.dietapp.ranking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RankingScoreRepository extends JpaRepository<RankingScore, UUID> {
    Optional<RankingScore> findByDietIdAndUserId(UUID dietId, UUID userId);

    List<RankingScore> findAllByDietId(UUID dietId);
}
