package com.dietapp.meal;

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

    public MealController(MealService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse create(@PathVariable UUID dietId,
                               @RequestHeader(value = "Idempotency-Key", required = false) UUID operationId,
                               @Valid @RequestBody MealRequest request) {
        return MealResponse.from(service.create(dietId, request.mealType(), request.description(),
                request.mealDate(), request.photoUrl(), operationId));
    }

    @GetMapping
    public List<MealResponse> list(
            @PathVariable UUID dietId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(dietId, from, to).stream().map(MealResponse::from).toList();
    }

    @GetMapping("/{mealId}")
    public MealResponse get(@PathVariable UUID dietId, @PathVariable UUID mealId) {
        return MealResponse.from(service.get(dietId, mealId));
    }

    @PutMapping("/{mealId}")
    public MealResponse update(@PathVariable UUID dietId, @PathVariable UUID mealId,
                               @Valid @RequestBody MealRequest request) {
        return MealResponse.from(service.update(dietId, mealId, request.mealType(), request.description(),
                request.mealDate(), request.photoUrl()));
    }

    @DeleteMapping("/{mealId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID dietId, @PathVariable UUID mealId) {
        service.delete(dietId, mealId);
    }

}
