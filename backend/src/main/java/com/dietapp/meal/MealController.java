package com.dietapp.meal;

import com.dietapp.comment.MealCommentService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import com.dietapp.common.Pagination;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/meals")
public class MealController {
    private static final Logger log = LoggerFactory.getLogger(MealController.class);
    private final MealService service;
    private final MealReactionService reactions;
    private final MealCommentService comments;

    public MealController(MealService service, MealReactionService reactions, MealCommentService comments) {
        this.service = service;
        this.reactions = reactions;
        this.comments = comments;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse create(@PathVariable UUID dietId,
                               @RequestHeader(value = "Idempotency-Key", required = false) UUID operationId,
                               @Valid @RequestBody MealRequest request) {
        long startedAt = System.currentTimeMillis();
        log.info("meal_create_started dietId={} operationId={} hasPhoto={}", dietId, operationId, request.photoUrl() != null);
        try {
            MealResponse result = response(service.create(dietId, request.mealType(), request.description(),
                    request.mealDate(), request.photoUrl(), operationId));
            log.info("meal_create_completed dietId={} operationId={} durationMs={}",
                    dietId, operationId, System.currentTimeMillis() - startedAt);
            return result;
        } catch (RuntimeException exception) {
            log.warn("meal_create_failed dietId={} operationId={} durationMs={} errorType={}",
                    dietId, operationId, System.currentTimeMillis() - startedAt, exception.getClass().getSimpleName());
            throw exception;
        }
    }

    @GetMapping
    public ResponseEntity<List<MealResponse>> list(
            @PathVariable UUID dietId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = service.list(dietId, from, to, Pagination.request(page, size));
        List<Meal> meals = result.getContent();
        var summaries = reactions.summariesFor(meals);
        var commentCounts = comments.countsFor(meals);
        List<MealResponse> response = meals.stream().map(meal -> MealResponse.from(
                meal, summaries.getOrDefault(meal.getId(), List.of()),
                commentCounts.getOrDefault(meal.getId(), 0L))).toList();
        return Pagination.headers(ResponseEntity.ok(), result).body(response);
    }

    @GetMapping("/{mealId}")
    public MealResponse get(@PathVariable UUID dietId, @PathVariable UUID mealId) {
        return response(service.get(dietId, mealId));
    }

    @PutMapping("/{mealId}")
    public MealResponse update(@PathVariable UUID dietId, @PathVariable UUID mealId,
                               @Valid @RequestBody MealRequest request) {
        return response(service.update(dietId, mealId, request.mealType(), request.description(),
                request.mealDate(), request.photoUrl()));
    }

    @DeleteMapping("/{mealId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID dietId, @PathVariable UUID mealId) {
        service.delete(dietId, mealId);
    }

    @PutMapping("/{mealId}/reaction")
    public MealReactionsResponse react(@PathVariable UUID dietId, @PathVariable UUID mealId,
                                       @Valid @RequestBody MealReactionRequest request) {
        return reactions.react(dietId, mealId, request.emoji());
    }

    @DeleteMapping("/{mealId}/reaction")
    public MealReactionsResponse removeReaction(@PathVariable UUID dietId, @PathVariable UUID mealId) {
        return reactions.remove(dietId, mealId);
    }

    private MealResponse response(Meal meal) {
        return MealResponse.from(meal, reactions.summariesFor(List.of(meal))
                .getOrDefault(meal.getId(), List.of()),
                comments.countsFor(List.of(meal)).getOrDefault(meal.getId(), 0L));
    }

}
