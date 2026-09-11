package com.dietapp.meal;

import com.dietapp.common.ForbiddenException;
import com.dietapp.common.BadRequestException;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class MealReactionService {
    private static final Pattern SINGLE_GRAPHEME = Pattern.compile("^\\X$");
    private final MealReactionRepository reactions;
    private final MealService meals;
    private final CurrentUser currentUser;

    public MealReactionService(MealReactionRepository reactions, MealService meals, CurrentUser currentUser) {
        this.reactions = reactions;
        this.meals = meals;
        this.currentUser = currentUser;
    }

    @Transactional
    public MealReactionsResponse react(UUID dietId, UUID mealId, String emoji) {
        Meal meal = meals.getForUpdate(dietId, mealId);
        User user = currentUser.require();
        requireDifferentAuthor(meal, user.getId());
        String normalizedEmoji = emoji.strip();
        if (!isEmoji(normalizedEmoji)) throw new BadRequestException("Invalid emoji");
        reactions.findByMealIdAndUserId(mealId, user.getId())
                .ifPresentOrElse(reaction -> reaction.update(normalizedEmoji),
                        () -> reactions.save(new MealReaction(meal, user, normalizedEmoji)));
        return responseFor(meal);
    }

    @Transactional
    public MealReactionsResponse remove(UUID dietId, UUID mealId) {
        Meal meal = meals.getForUpdate(dietId, mealId);
        UUID userId = currentUser.id();
        requireDifferentAuthor(meal, userId);
        reactions.findByMealIdAndUserId(mealId, userId).ifPresent(reactions::delete);
        return responseFor(meal);
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<MealReactionSummary>> summariesFor(Collection<Meal> meals) {
        if (meals.isEmpty()) return Map.of();
        List<UUID> mealIds = meals.stream().map(Meal::getId).toList();
        UUID userId = currentUser.id();
        Map<UUID, List<MealReactionSummary>> result = new HashMap<>();
        for (MealReactionCount count : reactions.summarize(mealIds, userId)) {
            result.computeIfAbsent(count.mealId(), ignored -> new ArrayList<>())
                    .add(new MealReactionSummary(count.emoji(), count.count(), count.currentUserCount() > 0));
        }
        result.values().forEach(summaries -> summaries.sort(
                Comparator.comparingLong(MealReactionSummary::count).reversed()
                        .thenComparing(MealReactionSummary::emoji)));
        return result;
    }

    private MealReactionsResponse responseFor(Meal meal) {
        return new MealReactionsResponse(summariesFor(List.of(meal)).getOrDefault(meal.getId(), List.of()));
    }

    private void requireDifferentAuthor(Meal meal, UUID userId) {
        if (meal.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("You cannot react to your own meal");
        }
    }

    private boolean isEmoji(String value) {
        if (!SINGLE_GRAPHEME.matcher(value).matches() || value.codePointCount(0, value.length()) > 16) return false;
        return value.codePoints().anyMatch(codePoint -> Character.getType(codePoint) == Character.OTHER_SYMBOL
                || codePoint == 0x20E3);
    }
}
