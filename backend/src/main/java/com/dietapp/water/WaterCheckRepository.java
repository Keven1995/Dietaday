package com.dietapp.water;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface WaterCheckRepository extends JpaRepository<WaterCheck, UUID> {
    boolean existsByUserId(UUID userId);

    boolean existsByUserIdAndCheckDate(UUID userId, LocalDate checkDate);

    boolean existsByDietIdAndUserIdAndCheckDate(UUID dietId, UUID userId, LocalDate checkDate);

    @Query("""
            select waterCheck.checkDate as checkDate, sum(waterCheck.amountMl) as consumedMl
            from WaterCheck waterCheck
            where waterCheck.user.id = :userId and waterCheck.diet is null
                and waterCheck.checkDate between :startDate and :endDate
            group by waterCheck.checkDate
            order by waterCheck.checkDate
            """)
    List<WaterCheckDailyTotal> sumGeneralByDate(@Param("userId") UUID userId,
                                                 @Param("startDate") LocalDate startDate,
                                                 @Param("endDate") LocalDate endDate);

    @Query("""
            select waterCheck.checkDate as checkDate, sum(waterCheck.amountMl) as consumedMl
            from WaterCheck waterCheck
            where waterCheck.user.id = :userId and waterCheck.diet.id = :dietId
                and waterCheck.checkDate between :startDate and :endDate
            group by waterCheck.checkDate
            order by waterCheck.checkDate
            """)
    List<WaterCheckDailyTotal> sumCompetitiveByDate(@Param("userId") UUID userId,
                                                     @Param("dietId") UUID dietId,
                                                     @Param("startDate") LocalDate startDate,
                                                     @Param("endDate") LocalDate endDate);

    List<WaterCheck> findByUserIdAndCheckDateOrderByCreatedAtAsc(UUID userId, LocalDate checkDate);

    List<WaterCheck> findByDietIdAndUserIdAndCheckDateOrderByCreatedAtAsc(UUID dietId, UUID userId, LocalDate checkDate);
}
