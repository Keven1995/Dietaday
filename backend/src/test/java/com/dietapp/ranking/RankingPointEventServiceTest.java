package com.dietapp.ranking;

import com.dietapp.common.ForbiddenException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.meal.Meal;
import com.dietapp.security.SecurityAuditService;
import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RankingPointEventServiceTest {
    private final RankingPointEventRepository events = mock(RankingPointEventRepository.class);
    private final DietMemberRepository members = mock(DietMemberRepository.class);
    private final SecurityAuditService audit = mock(SecurityAuditService.class);
    private final RankingPointEventService service = new RankingPointEventService(events, members, audit);

    @Test
    void ignoresEventsForNonCompetitiveDiets() {
        Diet diet = new Diet("Regular", LocalDate.now().minusDays(1), LocalDate.now().plusDays(1), false);
        User user = new User("regular@example.com", "hash", "Regular User", UserSex.FEMALE);
        Meal meal = new Meal(diet, user, "Almoço", "Almoço", LocalDate.now(), null);

        assertDoesNotThrow(() -> service.recordMeal(meal));

        verify(events, never()).saveAndFlush(any());
        verify(members, never()).existsByDietIdAndUserId(any(), any());
    }

    @Test
    void rejectsEventsForUsersOutsideTheDiet() {
        Diet diet = new Diet("Competitive", LocalDate.now().minusDays(1), LocalDate.now().plusDays(1), true);
        User user = new User("outsider@example.com", "hash", "Outsider", UserSex.FEMALE);
        Meal meal = new Meal(diet, user, "Almoço", "Almoço", LocalDate.now(), null);
        when(members.existsByDietIdAndUserId(diet.getId(), user.getId())).thenReturn(false);

        assertThrows(ForbiddenException.class, () -> service.recordMeal(meal));

        verify(events, never()).saveAndFlush(any());
    }

    @Test
    void processingTheSameSourceTwiceIsIdempotent() {
        Diet diet = new Diet("Competitive", LocalDate.now().minusDays(1), LocalDate.now().plusDays(1), true);
        User user = new User("member@example.com", "hash", "Member", UserSex.FEMALE);
        Meal meal = new Meal(diet, user, "Almoço", "Almoço", LocalDate.now(), null);
        RankingPointEvent existing = new RankingPointEvent(diet, user, RankingPointEvent.SourceType.MEAL,
                meal.getId(), meal.getMealType(), MealScoringPolicy.POINTS, meal.getMealDate());
        when(events.findBySourceTypeAndSourceId(RankingPointEvent.SourceType.MEAL, meal.getId()))
                .thenReturn(Optional.of(existing));

        assertDoesNotThrow(() -> service.recordMeal(meal));

        verify(events, never()).saveAndFlush(any());
        verify(members, never()).existsByDietIdAndUserId(eq(diet.getId()), eq(user.getId()));
    }
}
