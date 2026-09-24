package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.diet.DietRepository;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import com.dietapp.security.SecurityAuditService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DailyClosingServiceTest {
    private static final LocalDate DATE = LocalDate.of(2026, 9, 23);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-24T03:00:00Z"),
            ZoneId.of("America/Sao_Paulo"));

    private final DietRepository diets = mock(DietRepository.class);
    private final DietMemberRepository members = mock(DietMemberRepository.class);
    private final RankingPointEventRepository events = mock(RankingPointEventRepository.class);
    private final DailyRankingClosureRepository closures = mock(DailyRankingClosureRepository.class);
    private final DailyRankingTotalRepository totals = mock(DailyRankingTotalRepository.class);
    private final RankingAccumulationService accumulation = mock(RankingAccumulationService.class);
    private final SecurityAuditService audit = mock(SecurityAuditService.class);
    private final DailyClosingService service = new DailyClosingService(
            diets, members, events, closures, totals, accumulation, CLOCK, audit);

    @Test
    void persistsZeroTotalsAndSettlesEventsAtomically() {
        Diet diet = new Diet("Competition", DATE.minusDays(1), DATE.plusDays(1), true);
        User activeUser = new User("active@example.com", "hash", "Active", UserSex.FEMALE);
        User idleUser = new User("idle@example.com", "hash", "Idle", UserSex.MALE);
        RankingPointEvent event = new RankingPointEvent(diet, activeUser, RankingPointEvent.SourceType.MEAL,
                UUID.randomUUID(), "Almoço", 5, DATE);
        when(diets.findForUpdateById(diet.getId())).thenReturn(Optional.of(diet));
        when(closures.findByDietIdAndEventDate(diet.getId(), DATE)).thenReturn(Optional.empty());
        when(events.findAllByDietIdAndEventDateAndStatus(diet.getId(), DATE, RankingPointEvent.Status.PENDING))
                .thenReturn(List.of(event));
        when(members.findAllByDietId(diet.getId())).thenReturn(List.of(
                new DietMember(diet, activeUser, DietMember.Role.OWNER),
                new DietMember(diet, idleUser, DietMember.Role.MEMBER)));
        when(closures.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertTrue(service.closeDiet(diet.getId(), DATE));

        assertEquals(RankingPointEvent.Status.SETTLED, event.getStatus());
        verify(totals).saveAll(any());
        verify(events).saveAll(List.of(event));
    }

    @Test
    void doesNotDuplicateAnExistingClosure() {
        Diet diet = new Diet("Competition", DATE.minusDays(1), DATE.plusDays(1), true);
        when(diets.findForUpdateById(diet.getId())).thenReturn(Optional.of(diet));
        when(closures.findByDietIdAndEventDate(diet.getId(), DATE))
                .thenReturn(Optional.of(new DailyRankingClosure(diet, DATE, Instant.now())));

        assertFalse(service.closeDiet(diet.getId(), DATE));

        verify(events, never()).findAllByDietIdAndEventDateAndStatus(any(), any(), any());
        verify(totals, never()).saveAll(any());
    }

    @Test
    void leavesEventsPendingWhenSnapshotPersistenceFails() {
        Diet diet = new Diet("Competition", DATE.minusDays(1), DATE.plusDays(1), true);
        User user = new User("member@example.com", "hash", "Member", UserSex.FEMALE);
        RankingPointEvent event = new RankingPointEvent(diet, user, RankingPointEvent.SourceType.MEAL,
                UUID.randomUUID(), "Almoço", 5, DATE);
        when(diets.findForUpdateById(diet.getId())).thenReturn(Optional.of(diet));
        when(closures.findByDietIdAndEventDate(diet.getId(), DATE)).thenReturn(Optional.empty());
        when(events.findAllByDietIdAndEventDateAndStatus(diet.getId(), DATE, RankingPointEvent.Status.PENDING))
                .thenReturn(List.of(event));
        when(members.findAllByDietId(diet.getId())).thenReturn(List.of(
                new DietMember(diet, user, DietMember.Role.OWNER)));
        when(closures.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(totals.saveAll(any())).thenThrow(new IllegalStateException("snapshot failure"));

        assertThrows(IllegalStateException.class, () -> service.closeDiet(diet.getId(), DATE));

        assertEquals(RankingPointEvent.Status.PENDING, event.getStatus());
        verify(events, never()).saveAll(any());
    }
}
