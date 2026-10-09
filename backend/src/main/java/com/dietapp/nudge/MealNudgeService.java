package com.dietapp.nudge;

import com.dietapp.common.ConflictException;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.diet.DietService;
import com.dietapp.meal.MealRepository;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import com.dietapp.user.User;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MealNudgeService {
    private final MealNudgeRepository nudges;
    private final MealRepository meals;
    private final DietService diets;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;
    private final Clock clock;

    public MealNudgeService(MealNudgeRepository nudges, MealRepository meals, DietService diets,
                            DietMemberRepository members, CurrentUser currentUser,
                            SecurityAuditService audit, Clock clock) {
        this.nudges = nudges;
        this.meals = meals;
        this.diets = diets;
        this.members = members;
        this.currentUser = currentUser;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MealNudgeEligibilityResponse eligibility(UUID dietId, UUID recipientId) {
        Diet diet = diets.requireMember(dietId);
        UUID senderId = currentUser.id();
        DietMember recipientMembership = members.findByDietIdAndUserId(dietId, recipientId)
                .orElseThrow(() -> new NotFoundException("Diet member not found"));
        User recipient = recipientMembership.getUser();
        LocalDate today = LocalDate.now(clock);
        boolean activeDiet = isActiveToday(diet, today);
        Set<MealNudgeType> registeredTypes = registeredTypes(dietId, recipientId, today);
        Set<MealNudgeType> alreadySent = new HashSet<>(nudges.findSentTypes(dietId, senderId, recipientId, today));

        List<MealNudgeEligibilityResponse.MealEligibility> mealsForToday = Arrays.stream(MealNudgeType.values())
                .map(type -> eligibilityFor(type, senderId, recipientId, recipient, activeDiet,
                        registeredTypes.contains(type), alreadySent.contains(type)))
                .toList();
        return new MealNudgeEligibilityResponse(recipientId, today, mealsForToday);
    }

    @Transactional(readOnly = true)
    public List<MealNudgeMemberEligibilityResponse> eligibilityForMembers(UUID dietId) {
        Diet diet = diets.requireMember(dietId);
        UUID senderId = currentUser.id();
        LocalDate today = LocalDate.now(clock);
        boolean activeDiet = isActiveToday(diet, today);
        var memberList = members.findAllByDietId(dietId);

        var registeredByMember = meals.findDietDailyMealEntries(dietId, today).stream()
                .collect(Collectors.groupingBy(MealRepository.DietDailyMealEntry::getUserId,
                        Collectors.mapping(MealRepository.DietDailyMealEntry::getMealType, Collectors.toSet())));
        var sentByMember = nudges.findSentTypesForDiet(dietId, senderId, today).stream()
                .collect(Collectors.groupingBy(MealNudgeRepository.SentMealNudgeEntry::getRecipientId,
                        Collectors.mapping(MealNudgeRepository.SentMealNudgeEntry::getMealType, Collectors.toSet())));

        return memberList.stream().map(member -> {
            User recipient = member.getUser();
            Set<MealNudgeType> registered = toOfficialTypes(registeredByMember.getOrDefault(recipient.getId(), Set.of()));
            Set<MealNudgeType> sent = sentByMember.getOrDefault(recipient.getId(), Set.of());
            List<MealNudgeEligibilityResponse.MealEligibility> memberMeals = Arrays.stream(MealNudgeType.values())
                    .map(type -> eligibilityFor(type, senderId, recipient.getId(), recipient, activeDiet,
                            registered.contains(type), sent.contains(type)))
                    .toList();
            return new MealNudgeMemberEligibilityResponse(recipient.getId(), recipient.getFullName(), today, memberMeals);
        }).toList();
    }

    @Transactional
    public SendResult send(UUID dietId, MealNudgeRequest request) {
        // Meal creation uses the same diet-row lock. Rechecking pending state under it
        // serializes a nudge against registration of the meal being nudged.
        Diet diet = diets.requireMemberForUpdate(dietId);
        UUID senderId = currentUser.id();
        User sender = currentUser.require();
        if (senderId.equals(request.recipientId())) {
            throw new ConflictException("Você não pode cutucar a si mesmo.");
        }
        DietMember recipientMembership = members.findByDietIdAndUserId(dietId, request.recipientId())
                .orElseThrow(() -> new NotFoundException("Diet member not found"));
        User recipient = recipientMembership.getUser();
        MealNudgeType mealType = MealNudgeType.fromApiValue(request.mealType());
        LocalDate today = LocalDate.now(clock);

        if (!isActiveToday(diet, today)) {
            throw new ConflictException("Esta dieta não está ativa hoje.");
        }
        if (!recipient.isReceivingMealNudges()) {
            throw new ConflictException("Este membro desativou o recebimento de cutucadas.");
        }
        if (isMealRegistered(dietId, request.recipientId(), today, mealType)) {
            throw new ConflictException("A refeição selecionada já foi registrada.");
        }

        var existing = nudges.findByDietIdAndSenderIdAndRecipientIdAndMealDateAndMealType(
                dietId, senderId, request.recipientId(), today, mealType);
        if (existing.isPresent()) return new SendResult(existing.get(), false);

        MealNudge nudge = new MealNudge(diet, sender, recipient, mealType, today, clock.instant());
        try {
            MealNudge created = nudges.saveAndFlush(nudge);
            audit.mealNudgeSent(senderId, dietId, recipient.getId(), mealType.name());
            return new SendResult(created, true);
        } catch (DataIntegrityViolationException exception) {
            // The unique constraint is the final guard for simultaneous requests.
            throw new ConflictException("Você já enviou uma cutucada para esta refeição hoje.", exception);
        }
    }

    private MealNudgeEligibilityResponse.MealEligibility eligibilityFor(
            MealNudgeType type, UUID senderId, UUID recipientId, User recipient, boolean activeDiet,
            boolean mealRegistered, boolean alreadySent) {
        String reason = null;
        if (!activeDiet) reason = "DIET_NOT_ACTIVE";
        else if (senderId.equals(recipientId)) reason = "SELF";
        else if (mealRegistered) reason = "ALREADY_REGISTERED";
        else if (!recipient.isReceivingMealNudges()) reason = "PREFERENCE_DISABLED";
        else if (alreadySent) reason = "ALREADY_SENT";
        return new MealNudgeEligibilityResponse.MealEligibility(type.name(), type.label(), type.buttonLabel(),
                reason == null, alreadySent, reason);
    }

    private Set<MealNudgeType> registeredTypes(UUID dietId, UUID recipientId, LocalDate date) {
        Set<String> persistedValues = meals.findDailyMealEntries(dietId, recipientId, date, date).stream()
                .map(MealRepository.DailyMealEntry::getMealType).collect(Collectors.toSet());
        return toOfficialTypes(persistedValues);
    }

    private Set<MealNudgeType> toOfficialTypes(Iterable<String> persistedValues) {
        Set<String> values = new HashSet<>();
        persistedValues.forEach(values::add);
        return Arrays.stream(MealNudgeType.values())
                .filter(type -> type.storedMealTypeValues().stream().anyMatch(values::contains))
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(MealNudgeType.class)));
    }

    private boolean isMealRegistered(UUID dietId, UUID recipientId, LocalDate date, MealNudgeType type) {
        return meals.existsByDiet_IdAndAuthor_IdAndMealDateAndMealTypeIn(
                dietId, recipientId, date, type.storedMealTypeValues());
    }

    private boolean isActiveToday(Diet diet, LocalDate today) {
        return !today.isBefore(diet.getStartDate()) && !today.isAfter(diet.getEndDate());
    }

    public record SendResult(MealNudge nudge, boolean created) {}
}
