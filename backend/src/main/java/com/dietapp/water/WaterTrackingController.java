package com.dietapp.water;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/water")
public class WaterTrackingController {
    private final WaterTrackingService service;
    private final WaterHistoryService history;

    public WaterTrackingController(WaterTrackingService service, WaterHistoryService history) {
        this.service = service;
        this.history = history;
    }

    @GetMapping("/today")
    public WaterTodayResponse today() {
        return service.today();
    }

    @GetMapping("/history")
    public WaterHistoryResponse history(@RequestParam String month) {
        return history.generalHistory(month);
    }

    @GetMapping("/has-checks")
    public boolean hasEverChecked() {
        return service.hasEverChecked();
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
