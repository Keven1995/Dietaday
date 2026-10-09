package com.dietapp.nudge;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/meal-nudges")
public class MealNudgeController {
    private final MealNudgeService service;

    public MealNudgeController(MealNudgeService service) {
        this.service = service;
    }

    @GetMapping("/eligibility")
    public MealNudgeEligibilityResponse eligibility(@PathVariable UUID dietId,
                                                     @RequestParam UUID recipientId) {
        return service.eligibility(dietId, recipientId);
    }

    @GetMapping("/eligibility/all")
    public java.util.List<MealNudgeMemberEligibilityResponse> allEligibility(@PathVariable UUID dietId) {
        return service.eligibilityForMembers(dietId);
    }

    @PostMapping
    public ResponseEntity<MealNudgeResponse> send(@PathVariable UUID dietId,
                                                   @Valid @RequestBody MealNudgeRequest request) {
        MealNudgeService.SendResult result = service.send(dietId, request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(MealNudgeResponse.from(result.nudge()));
    }
}
