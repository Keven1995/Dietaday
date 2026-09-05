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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/diets")
public class DietController {
    private final DietService service;

    public DietController(DietService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DietResponse create(@Valid @RequestBody DietRequest request) {
        return DietResponse.from(service.create(request.name(), request.startDate(), request.endDate()));
    }

    @GetMapping
    public List<DietResponse> list() {
        return service.list().stream().map(DietResponse::from).toList();
    }

    @GetMapping("/{dietId}")
    public DietResponse get(@PathVariable UUID dietId) {
        return DietResponse.from(service.requireMember(dietId));
    }

    @PutMapping("/{dietId}")
    public DietResponse update(@PathVariable UUID dietId, @Valid @RequestBody DietRequest request) {
        return DietResponse.from(service.update(dietId, request.name(), request.startDate(), request.endDate()));
    }

    @DeleteMapping("/{dietId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID dietId) {
        service.delete(dietId);
    }

    @GetMapping("/{dietId}/members")
    public List<MemberResponse> members(@PathVariable UUID dietId) {
        return service.listMembers(dietId).stream().map(MemberResponse::from).toList();
    }

    @PostMapping("/{dietId}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable UUID dietId, @Valid @RequestBody LeaveDietRequest request) {
        service.leave(dietId, request.successorId());
    }
}
