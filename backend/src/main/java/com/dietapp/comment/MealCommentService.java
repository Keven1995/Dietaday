package com.dietapp.comment;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.meal.Meal;
import com.dietapp.meal.MealService;
import com.dietapp.notification.NotificationService;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
public class MealCommentService {
    private static final Pattern SINGLE_GRAPHEME = Pattern.compile("^\\X$");
    private final MealCommentRepository comments;
    private final CommentReactionRepository reactions;
    private final MealService meals;
    private final NotificationService notifications;
    private final CurrentUser currentUser;

    public MealCommentService(MealCommentRepository comments, CommentReactionRepository reactions,
                              MealService meals, NotificationService notifications, CurrentUser currentUser) {
        this.comments = comments;
        this.reactions = reactions;
        this.meals = meals;
        this.notifications = notifications;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public Page<CommentResponse> list(UUID dietId, UUID mealId, Pageable pageable) {
        meals.get(dietId, mealId);
        Page<MealComment> result = comments.findAllByMealIdOrderByCreatedAtAsc(mealId, pageable);
        Map<UUID, List<CommentReactionSummary>> summaries = summariesFor(result.getContent());
        return result.map(comment -> CommentResponse.from(comment,
                summaries.getOrDefault(comment.getId(), List.of())));
    }

    @Transactional
    public CommentResponse create(UUID dietId, UUID mealId, String content) {
        Meal meal = meals.get(dietId, mealId);
        User author = currentUser.require();
        MealComment comment = comments.save(new MealComment(meal, author, content));
        if (!meal.getAuthor().getId().equals(author.getId())) {
            notifications.mealCommented(meal.getDiet(), meal, comment, meal.getAuthor(), author);
        }
        return CommentResponse.from(comment, List.of());
    }

    @Transactional
    public CommentResponse update(UUID dietId, UUID mealId, UUID commentId, String content) {
        MealComment comment = requireScoped(dietId, mealId, commentId);
        requireAuthor(comment);
        comment.update(content);
        return CommentResponse.from(comment, summariesFor(List.of(comment))
                .getOrDefault(comment.getId(), List.of()));
    }

    @Transactional
    public void delete(UUID dietId, UUID mealId, UUID commentId) {
        MealComment comment = requireScoped(dietId, mealId, commentId);
        requireAuthor(comment);
        comments.delete(comment);
    }

    @Transactional
    public CommentReactionsResponse react(UUID dietId, UUID mealId, UUID commentId, String emoji) {
        Meal meal = meals.getForUpdate(dietId, mealId);
        MealComment comment = requireScopedAfterMealCheck(dietId, mealId, commentId);
        User user = currentUser.require();
        requireMealAuthorForReaction(meal, comment, user.getId());
        String normalizedEmoji = emoji.strip();
        if (!isEmoji(normalizedEmoji)) throw new BadRequestException("Invalid emoji");
        reactions.findByCommentIdAndUserId(commentId, user.getId())
                .ifPresentOrElse(reaction -> reaction.update(normalizedEmoji),
                        () -> reactions.save(new CommentReaction(comment, user, normalizedEmoji)));
        return reactionResponse(comment);
    }

    @Transactional
    public CommentReactionsResponse removeReaction(UUID dietId, UUID mealId, UUID commentId) {
        Meal meal = meals.getForUpdate(dietId, mealId);
        MealComment comment = requireScopedAfterMealCheck(dietId, mealId, commentId);
        UUID userId = currentUser.id();
        requireMealAuthorForReaction(meal, comment, userId);
        reactions.findByCommentIdAndUserId(commentId, userId).ifPresent(reactions::delete);
        return reactionResponse(comment);
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> countsFor(Collection<Meal> meals) {
        if (meals.isEmpty()) return Map.of();
        Map<UUID, Long> result = new HashMap<>();
        comments.countByMealIds(meals.stream().map(Meal::getId).toList())
                .forEach(count -> result.put(count.mealId(), count.count()));
        return result;
    }

    private MealComment requireScoped(UUID dietId, UUID mealId, UUID commentId) {
        meals.get(dietId, mealId);
        return requireScopedAfterMealCheck(dietId, mealId, commentId);
    }

    private MealComment requireScopedAfterMealCheck(UUID dietId, UUID mealId, UUID commentId) {
        return comments.findScoped(dietId, mealId, commentId)
                .orElseThrow(() -> new NotFoundException("Comment not found"));
    }

    private void requireAuthor(MealComment comment) {
        if (!comment.getAuthor().getId().equals(currentUser.id())) {
            throw new ForbiddenException("Only the comment author can perform this action");
        }
    }

    private void requireMealAuthorForReaction(Meal meal, MealComment comment, UUID userId) {
        if (!meal.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("Only the meal author can react to comments");
        }
        if (comment.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("You cannot react to your own comment");
        }
    }

    private Map<UUID, List<CommentReactionSummary>> summariesFor(Collection<MealComment> comments) {
        if (comments.isEmpty()) return Map.of();
        Map<UUID, List<CommentReactionSummary>> result = new HashMap<>();
        for (CommentReactionCount count : reactions.summarize(
                comments.stream().map(MealComment::getId).toList(), currentUser.id())) {
            result.computeIfAbsent(count.commentId(), ignored -> new ArrayList<>())
                    .add(new CommentReactionSummary(count.emoji(), count.count(), count.currentUserCount() > 0));
        }
        result.values().forEach(summaries -> summaries.sort(
                Comparator.comparingLong(CommentReactionSummary::count).reversed()
                        .thenComparing(CommentReactionSummary::emoji)));
        return result;
    }

    private CommentReactionsResponse reactionResponse(MealComment comment) {
        return new CommentReactionsResponse(summariesFor(List.of(comment))
                .getOrDefault(comment.getId(), List.of()));
    }

    private boolean isEmoji(String value) {
        if (!SINGLE_GRAPHEME.matcher(value).matches() || value.codePointCount(0, value.length()) > 16) return false;
        return value.codePoints().anyMatch(codePoint -> Character.getType(codePoint) == Character.OTHER_SYMBOL
                || codePoint == 0x20E3);
    }
}
