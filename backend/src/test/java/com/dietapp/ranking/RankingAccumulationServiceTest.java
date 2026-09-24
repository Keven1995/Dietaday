package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RankingAccumulationServiceTest {
    @Test
    void initializesAllMembersAndCreatesDailyPositions() {
        Diet diet = new Diet("Competition", LocalDate.now().minusDays(2), LocalDate.now(), true);
        User active = new User("active@example.com", "hash", "Active", UserSex.FEMALE);
        User idle = new User("idle@example.com", "hash", "Idle", UserSex.MALE);
        DailyRankingClosure closure = new DailyRankingClosure(diet, LocalDate.now().minusDays(1),
                Instant.parse("2026-09-24T00:00:00Z"));
        DailyRankingTotal activeTotal = new DailyRankingTotal(closure, active, 1, 0, 5);
        DailyRankingTotal idleTotal = new DailyRankingTotal(closure, idle, 0, 0, 0);
        RankingScoreRepository scores = mock(RankingScoreRepository.class);
        RankingDailyPositionRepository positions = mock(RankingDailyPositionRepository.class);
        RankingAccumulationService service = new RankingAccumulationService(scores, positions,
                Clock.system(ZoneId.of("America/Sao_Paulo")));
        when(scores.findByDietIdAndUserId(any(), any())).thenReturn(Optional.empty());
        org.mockito.ArgumentCaptor<List<RankingDailyPosition>> captor =
                org.mockito.ArgumentCaptor.forClass(List.class);

        service.accumulate(closure, List.of(activeTotal, idleTotal), List.of(
                new DietMember(diet, active, DietMember.Role.OWNER),
                new DietMember(diet, idle, DietMember.Role.MEMBER)));

        org.mockito.Mockito.verify(positions).saveAll(captor.capture());
        List<RankingDailyPosition> saved = captor.getValue();
        assertEquals(2, saved.size());
        assertEquals(5, saved.get(0).getPoints());
        assertEquals(1, saved.get(0).getPosition());
    }
}
