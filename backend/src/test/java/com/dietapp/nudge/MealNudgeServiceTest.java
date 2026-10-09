package com.dietapp.nudge;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.diet.DietService;
import com.dietapp.meal.MealRepository;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MealNudgeServiceTest {
    @Test
    void allSixMealsRemainEligibleAtAnyTimeUsingTheSaoPauloLocalDate() {
        UUID dietId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        LocalDate localDate = LocalDate.of(2026, 10, 8);
        Clock clock = Clock.fixed(Instant.parse("2026-10-09T02:30:00Z"),
                ZoneId.of("America/Sao_Paulo")); // 23:30 on the previous local date.
        Diet diet = new Diet("Night diet", localDate, localDate.plusDays(1), false);
        User recipient = new User("recipient@example.com", "hash", "Recipient", UserSex.NEUTRAL);
        DietMember recipientMembership = new DietMember(diet, recipient, DietMember.Role.MEMBER);

        MealNudgeRepository nudges = mock(MealNudgeRepository.class);
        MealRepository meals = mock(MealRepository.class);
        DietService diets = mock(DietService.class);
        DietMemberRepository members = mock(DietMemberRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        SecurityAuditService audit = mock(SecurityAuditService.class);
        when(currentUser.id()).thenReturn(senderId);
        when(diets.requireMember(dietId)).thenReturn(diet);
        when(members.findByDietIdAndUserId(dietId, recipientId)).thenReturn(Optional.of(recipientMembership));
        when(meals.findDailyMealEntries(dietId, recipientId, localDate, localDate)).thenReturn(List.of());
        when(nudges.findSentTypes(dietId, senderId, recipientId, localDate)).thenReturn(List.of());

        MealNudgeService service = new MealNudgeService(nudges, meals, diets, members, currentUser, audit, clock);
        MealNudgeEligibilityResponse eligibility = service.eligibility(dietId, recipientId);

        assertThat(eligibility.mealDate()).isEqualTo(localDate);
        assertThat(eligibility.meals()).hasSize(6).allMatch(MealNudgeEligibilityResponse.MealEligibility::eligible);
        assertThat(eligibility.meals()).extracting(MealNudgeEligibilityResponse.MealEligibility::mealType)
                .containsExactly("BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER", "SUPPER");
        verify(meals).findDailyMealEntries(dietId, recipientId, localDate, localDate);
    }
}
