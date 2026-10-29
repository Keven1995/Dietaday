package com.dietapp.diet;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.http.ResponseEntity;
import com.dietapp.common.Pagination;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/diets")
public class DietController {
    private final DietService service;
    private final DietMealTypeService mealTypes;

    public DietController(DietService service, DietMealTypeService mealTypes) {
        this.service = service;
        this.mealTypes = mealTypes;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DietResponse create(@RequestHeader("Idempotency-Key") UUID operationId,
                               @Valid @RequestBody DietRequest request) {
        Diet diet = service.create(request.name(), request.startDate(), request.endDate(),
                request.competitiveMode(), operationId, request.mealTypes());
        return response(diet, true, mealTypes.scheduleForMember(diet.getId()));
    }

    @GetMapping
    public ResponseEntity<List<DietResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "50") int size) {
        var result = service.list(Pagination.request(page, size));
        List<Diet> diets = result.getContent();
        Set<UUID> ownedDiets = service.ownedDietIds(diets.stream().map(Diet::getId).toList());
        Map<UUID, List<DietMealTypeScheduleEntry>> mealTypeSchedules = mealTypes.schedulesForDiets(diets);
        return Pagination.headers(ResponseEntity.ok(), result).body(result.getContent().stream()
                .map(diet -> response(diet, ownedDiets.contains(diet.getId()), mealTypeSchedules.get(diet.getId())))
                .toList());
    }

    @GetMapping("/{dietId}")
    public DietResponse get(@PathVariable UUID dietId) {
        Diet diet = service.requireMember(dietId);
        return response(diet, service.isOwner(dietId), mealTypes.scheduleForMember(dietId));
    }

    @PutMapping("/{dietId}")
    public DietResponse update(@PathVariable UUID dietId, @Valid @RequestBody DietRequest request) {
        Diet diet = service.update(dietId, request.name(), request.startDate(), request.endDate(), request.competitiveMode());
        return response(diet, true, mealTypes.scheduleForMember(dietId));
    }

    @GetMapping("/{dietId}/meal-types")
    public List<DietMealTypeScheduleEntry> mealTypes(@PathVariable UUID dietId) {
        return mealTypes.scheduleForMember(dietId);
    }

    @PutMapping("/{dietId}/meal-types")
    public List<DietMealTypeScheduleEntry> updateMealTypes(@PathVariable UUID dietId,
                                                           @Valid @RequestBody UpdateDietMealTypesRequest request) {
        return mealTypes.update(dietId, request.mealTypes());
    }

    @DeleteMapping("/{dietId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID dietId) {
        service.delete(dietId);
    }

    @GetMapping("/{dietId}/members")
    public ResponseEntity<List<MemberResponse>> members(@PathVariable UUID dietId,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "50") int size) {
        var result = service.listMembers(dietId, Pagination.request(page, size));
        return Pagination.headers(ResponseEntity.ok(), result).body(result.getContent().stream()
                .map(MemberResponse::from).toList());
    }

    @PostMapping("/{dietId}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable UUID dietId, @Valid @RequestBody LeaveDietRequest request) {
        service.leave(dietId, request.successorId());
    }

    private DietResponse response(Diet diet, boolean canManageMealTypes,
                                  List<DietMealTypeScheduleEntry> schedule) {
        return new DietResponse(diet.getId(), diet.getName(), diet.getStartDate(), diet.getEndDate(),
                diet.isCompetitiveMode(), canManageMealTypes, schedule);
    }
}
