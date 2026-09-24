package com.dietapp.meal;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietService;
import com.dietapp.security.CurrentUser;
import com.dietapp.upload.PhotoUrlPolicy;
import com.dietapp.ranking.RankingPointEventService;
import com.dietapp.ranking.CompetitivePeriodPolicy;
import com.dietapp.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.time.ZoneId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
public class MealService {
    private final MealRepository meals;
    private final MealSyncOperationRepository syncOperations;
    private final DietService diets;
    private final CurrentUser currentUser;
    private final PhotoUrlPolicy photoUrlPolicy;
    private final RankingPointEventService rankingEvents;

    public MealService(MealRepository meals, MealSyncOperationRepository syncOperations,
                       DietService diets, CurrentUser currentUser, PhotoUrlPolicy photoUrlPolicy,
                       RankingPointEventService rankingEvents) {
        this.meals = meals;
        this.syncOperations = syncOperations;
        this.diets = diets;
        this.currentUser = currentUser;
        this.photoUrlPolicy = photoUrlPolicy;
        this.rankingEvents = rankingEvents;
    }

    @Transactional
    public Meal create(UUID dietId, String mealType, String description, LocalDate mealDate,
                       String photoUrl, UUID operationId) {
        photoUrlPolicy.validate(photoUrl);
        Diet diet = operationId == null ? diets.requireMember(dietId) : diets.requireMemberForUpdate(dietId);
        User author = currentUser.require();
        ensureCompetitiveWriteAllowed(diet);
        if (operationId == null) {
            Meal meal = meals.save(new Meal(diet, author, mealType, description, mealDate, photoUrl));
            rankingEvents.recordMeal(meal);
            return meal;
        }

        String requestHash = requestHash(mealType, description, mealDate, photoUrl);
        var existing = syncOperations.findById(operationId);
        if (existing.isPresent()) {
            MealSyncOperation operation = existing.get();
            if (!operation.getUser().getId().equals(author.getId())
                    || !operation.getDiet().getId().equals(dietId)
                    || !operation.getRequestHash().equals(requestHash)) {
                throw new ConflictException("Idempotency key has already been used for another request");
            }
            return operation.getMeal();
        }

        Meal meal = meals.save(new Meal(diet, author, mealType, description, mealDate, photoUrl));
        rankingEvents.recordMeal(meal);
        try {
            syncOperations.saveAndFlush(new MealSyncOperation(operationId, author, diet, meal, requestHash));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Idempotency key has already been used for another request", exception);
        }
        return meal;
    }

    @Transactional(readOnly = true)
    public Page<Meal> list(UUID dietId, LocalDate fromDate, LocalDate toDate, Pageable pageable) {
        diets.requireMember(dietId);
        if (fromDate != null && toDate != null && toDate.isBefore(fromDate)) {
            throw new BadRequestException("to must be on or after from");
        }
        return meals.findHistory(dietId, fromDate, toDate, pageable);
    }

    @Transactional(readOnly = true)
    public Meal get(UUID dietId, UUID mealId) {
        diets.requireMember(dietId);
        return meals.findByIdAndDietId(mealId, dietId).orElseThrow(() -> new NotFoundException("Meal not found"));
    }

    @Transactional
    public Meal getForUpdate(UUID dietId, UUID mealId) {
        diets.requireMember(dietId);
        return meals.findForUpdateByIdAndDietId(mealId, dietId)
                .orElseThrow(() -> new NotFoundException("Meal not found"));
    }

    @Transactional
    public Meal update(UUID dietId, UUID mealId, String mealType, String description,
                       LocalDate mealDate, String photoUrl) {
        photoUrlPolicy.validate(photoUrl);
        Meal meal = get(dietId, mealId);
        requireAuthor(meal);
        ensureCompetitiveWriteAllowed(meal.getDiet());
        meal.update(mealType, description, mealDate, photoUrl);
        return meal;
    }

    @Transactional
    public void delete(UUID dietId, UUID mealId) {
        Meal meal = get(dietId, mealId);
        requireAuthor(meal);
        ensureCompetitiveWriteAllowed(meal.getDiet());
        rankingEvents.revokeMeal(meal.getId());
        meals.delete(meal);
    }

    private void requireAuthor(Meal meal) {
        if (!meal.getAuthor().getId().equals(currentUser.id())) {
            throw new ForbiddenException("Only the meal author can perform this action");
        }
    }

    private void ensureCompetitiveWriteAllowed(Diet diet) {
        CompetitivePeriodPolicy.validateWriteToday(diet, LocalDate.now(ZoneId.of("America/Sao_Paulo")));
    }

    private String requestHash(String mealType, String description, LocalDate mealDate, String photoUrl) {
        String value = mealType.trim() + "\u0000" + description.trim() + "\u0000" + mealDate
                + "\u0000" + (photoUrl == null || photoUrl.isBlank() ? "" : photoUrl.trim());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
