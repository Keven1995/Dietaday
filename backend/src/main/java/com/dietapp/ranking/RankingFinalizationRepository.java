package com.dietapp.ranking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RankingFinalizationRepository extends JpaRepository<RankingFinalization, UUID> {
    Optional<RankingFinalization> findByDietId(UUID dietId);
}
