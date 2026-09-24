package com.dietapp.ranking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DailyRankingTotalRepository extends JpaRepository<DailyRankingTotal, UUID> {
}
