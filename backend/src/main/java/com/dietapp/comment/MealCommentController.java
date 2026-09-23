package com.dietapp.comment;

import com.dietapp.meal.MealReactionRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestParam;
import com.dietapp.common.Pagination;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/meals/{mealId}/comments")
public class MealCommentController {
    private final MealCommentService service;

    public MealCommentController(MealCommentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<CommentResponse>> list(@PathVariable UUID dietId, @PathVariable UUID mealId,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "50") int size) {
        var result = service.list(dietId, mealId, Pagination.request(page, size));
        return Pagination.headers(ResponseEntity.ok(), result).body(result.getContent());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(@PathVariable UUID dietId, @PathVariable UUID mealId,
                                  @Valid @RequestBody CommentRequest request) {
        return service.create(dietId, mealId, request.content());
    }

    @PutMapping("/{commentId}")
    public CommentResponse update(@PathVariable UUID dietId, @PathVariable UUID mealId,
                                  @PathVariable UUID commentId, @Valid @RequestBody CommentRequest request) {
        return service.update(dietId, mealId, commentId, request.content());
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID dietId, @PathVariable UUID mealId, @PathVariable UUID commentId) {
        service.delete(dietId, mealId, commentId);
    }

    @PutMapping("/{commentId}/reaction")
    public CommentReactionsResponse react(@PathVariable UUID dietId, @PathVariable UUID mealId,
                                           @PathVariable UUID commentId,
                                           @Valid @RequestBody MealReactionRequest request) {
        return service.react(dietId, mealId, commentId, request.emoji());
    }

    @DeleteMapping("/{commentId}/reaction")
    public CommentReactionsResponse removeReaction(@PathVariable UUID dietId, @PathVariable UUID mealId,
                                                    @PathVariable UUID commentId) {
        return service.removeReaction(dietId, mealId, commentId);
    }
}
