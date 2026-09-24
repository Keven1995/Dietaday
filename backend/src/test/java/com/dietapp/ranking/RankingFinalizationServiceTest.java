package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietRepository;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RankingFinalizationServiceTest {
    private final DietRepository diets = mock(DietRepository.class);
    private final RankingScoreRepository scores = mock(RankingScoreRepository.class);
    private final RankingFinalizationRepository finalizations = mock(RankingFinalizationRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-01T03:00:00Z"),
            ZoneId.of("America/Sao_Paulo"));
    private final RankingFinalizationService service = new RankingFinalizationService(
            diets, scores, finalizations, clock);

    @Test
    void freezesTheRankingAndStoresThePodiumAfterTheEndDate() {
        Diet diet = new Diet("Competition", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), true);
        User first = new User("first@example.com", "hash", "First", UserSex.FEMALE);
        User second = new User("second@example.com", "hash", "Second", UserSex.MALE);
        RankingScore firstScore = new RankingScore(diet, first, 10);
        RankingScore secondScore = new RankingScore(diet, second, 20);
        firstScore.addDailyPoints(10, Instant.parse("2026-09-10T00:00:00Z"));
        secondScore.addDailyPoints(5, Instant.parse("2026-09-09T00:00:00Z"));
        when(diets.findForUpdateById(diet.getId())).thenReturn(Optional.of(diet));
        when(finalizations.findByDietId(diet.getId())).thenReturn(Optional.empty());
        when(scores.findAllByDietId(diet.getId())).thenReturn(List.of(secondScore, firstScore));
        when(finalizations.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertTrue(service.finalizeIfEnded(diet.getId()));

        org.mockito.ArgumentCaptor<RankingFinalization> captor =
                org.mockito.ArgumentCaptor.forClass(RankingFinalization.class);
        verify(finalizations).save(captor.capture());
        assertEquals(first, captor.getValue().getFirst());
        assertEquals(second, captor.getValue().getSecond());
        assertTrue(captor.getValue().getFinalizedAt() != null);
    }

    @Test
    void doesNotFinalizeTheSameDietTwice() {
        Diet diet = new Diet("Competition", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), true);
        when(diets.findForUpdateById(diet.getId())).thenReturn(Optional.of(diet));
        when(finalizations.findByDietId(diet.getId()))
                .thenReturn(Optional.of(new RankingFinalization(diet, Instant.now(), null, null, null)));

        assertFalse(service.finalizeIfEnded(diet.getId()));

        verify(finalizations, never()).save(any());
    }
}
