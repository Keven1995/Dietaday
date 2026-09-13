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

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/meals")
public class MealController {
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
        return response(service.create(dietId, request.mealType(), request.description(),
                request.mealDate(), request.photoUrl(), operationId));
    }

    @GetMapping
    public List<MealResponse> list(
            @PathVariable UUID dietId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        List<Meal> meals = service.list(dietId, from, to);
        var summaries = reactions.summariesFor(meals);
        var commentCounts = comments.countsFor(meals);
        return meals.stream().map(meal -> MealResponse.from(
                meal, summaries.getOrDefault(meal.getId(), List.of()),
                commentCounts.getOrDefault(meal.getId(), 0L))).toList();
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
