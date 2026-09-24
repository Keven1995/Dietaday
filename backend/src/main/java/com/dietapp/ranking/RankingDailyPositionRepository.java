package com.dietapp.ranking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RankingDailyPositionRepository extends JpaRepository<RankingDailyPosition, UUID> {
    List<RankingDailyPosition> findAllByClosureIdOrderByPosition(UUID closureId);
}
