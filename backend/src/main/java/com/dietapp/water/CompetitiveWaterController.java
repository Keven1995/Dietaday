package com.dietapp.water;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/water")
public class CompetitiveWaterController {
    private final WaterTrackingService service;

    public CompetitiveWaterController(WaterTrackingService service) {
        this.service = service;
    }

    @GetMapping("/today")
    public WaterTodayResponse today(@PathVariable UUID dietId) {
        return service.competitiveToday(dietId);
    }

    @PutMapping("/goal")
    public WaterTodayResponse updateGoal(@PathVariable UUID dietId,
                                         @Valid @RequestBody WaterGoalRequest request) {
        return service.updateCompetitiveGoal(dietId, request.goalMl());
    }

    @PostMapping("/checks")
    public WaterTodayResponse addCheck(@PathVariable UUID dietId,
                                       @Valid @RequestBody WaterCheckRequest request) {
        return service.addCompetitiveCheck(dietId, request.amountMl());
    }
}
