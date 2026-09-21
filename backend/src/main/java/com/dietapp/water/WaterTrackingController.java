package com.dietapp.water;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/water")
public class WaterTrackingController {
    private final WaterTrackingService service;

    public WaterTrackingController(WaterTrackingService service) {
        this.service = service;
    }

    @GetMapping("/today")
    public WaterTodayResponse today() {
        return service.today();
    }

    @PutMapping("/goal")
    public WaterTodayResponse updateGoal(@Valid @RequestBody WaterGoalRequest request) {
        return service.updateGoal(request.goalMl());
    }

    @PostMapping("/checks")
    public WaterTodayResponse addCheck(@Valid @RequestBody WaterCheckRequest request) {
        return service.addCheck(request.amountMl());
    }
}
