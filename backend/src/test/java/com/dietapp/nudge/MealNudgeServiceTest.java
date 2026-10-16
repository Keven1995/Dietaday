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
import com.dietapp.water.PushNotificationService;
import com.dietapp.water.PushSubscription;
import com.dietapp.water.PushSubscriptionRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
        PushSubscriptionRepository pushSubscriptions = mock(PushSubscriptionRepository.class);
        PushNotificationService push = mock(PushNotificationService.class);
        when(currentUser.id()).thenReturn(senderId);
        when(diets.requireMember(dietId)).thenReturn(diet);
        when(members.findByDietIdAndUserId(dietId, recipientId)).thenReturn(Optional.of(recipientMembership));
        when(meals.findDailyMealEntries(dietId, recipientId, localDate, localDate)).thenReturn(List.of());
        when(nudges.findSentTypes(dietId, senderId, recipientId, localDate)).thenReturn(List.of());

        MealNudgeService service = new MealNudgeService(nudges, meals, diets, members, currentUser, audit,
                pushSubscriptions, push, clock);
        MealNudgeEligibilityResponse eligibility = service.eligibility(dietId, recipientId);

        assertThat(eligibility.mealDate()).isEqualTo(localDate);
        assertThat(eligibility.meals()).hasSize(6).allMatch(MealNudgeEligibilityResponse.MealEligibility::eligible);
        assertThat(eligibility.meals()).extracting(MealNudgeEligibilityResponse.MealEligibility::mealType)
                .containsExactly("BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER", "SUPPER");
        verify(meals).findDailyMealEntries(dietId, recipientId, localDate, localDate);
    }

    @Test
    void sendsPushToEveryEnabledRecipientSubscriptionWhenNudgeIsCreated() {
        UUID dietId = UUID.randomUUID();
        LocalDate date = LocalDate.of(2026, 10, 8);
        Clock clock = Clock.fixed(Instant.parse("2026-10-08T15:00:00Z"), ZoneId.of("UTC"));
        Diet diet = new Diet("Diet", date, date, false);
        User sender = new User("sender@example.com", "hash", "Sender", UserSex.NEUTRAL);
        User recipient = new User("recipient@example.com", "hash", "Recipient", UserSex.NEUTRAL);
        UUID senderId = sender.getId();
        UUID recipientId = recipient.getId();
        DietMember recipientMembership = new DietMember(diet, recipient, DietMember.Role.MEMBER);
        PushSubscriptionRepository pushSubscriptions = mock(PushSubscriptionRepository.class);
        PushNotificationService push = mock(PushNotificationService.class);
        PushSubscription subscription = new PushSubscription(recipient, "https://push.example/1", "p256dh", "auth");

        MealNudgeRepository nudges = mock(MealNudgeRepository.class);
        MealRepository meals = mock(MealRepository.class);
        DietService diets = mock(DietService.class);
        DietMemberRepository members = mock(DietMemberRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        SecurityAuditService audit = mock(SecurityAuditService.class);
        when(currentUser.id()).thenReturn(senderId);
        when(currentUser.require()).thenReturn(sender);
        when(diets.requireMemberForUpdate(dietId)).thenReturn(diet);
        when(members.findByDietIdAndUserId(dietId, recipientId)).thenReturn(Optional.of(recipientMembership));
        when(meals.existsByDiet_IdAndAuthor_IdAndMealDateAndMealTypeIn(
                dietId, recipientId, date, MealNudgeType.LUNCH.storedMealTypeValues())).thenReturn(false);
        when(nudges.findByDietIdAndSenderIdAndRecipientIdAndMealDateAndMealType(
                dietId, senderId, recipientId, date, MealNudgeType.LUNCH)).thenReturn(Optional.empty());
        when(nudges.saveAndFlush(any(MealNudge.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(pushSubscriptions.findByUserIdAndEnabledTrue(recipientId)).thenReturn(List.of(subscription));

        MealNudgeService service = new MealNudgeService(nudges, meals, diets, members, currentUser, audit,
                pushSubscriptions, push, clock);

        service.send(dietId, new MealNudgeRequest(recipientId, "LUNCH"));

        verify(push).send(eq(subscription), eq("Você recebeu uma cutucada 👀"), eq("Sender perguntou: 👀 Cadê o almoço?"),
                eq("/refeicoes/nova?mealType=LUNCH&mealDate=2026-10-08"), any(String.class));
    }
}
