package com.dietapp.meal;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/progress")
public class DailyProgressController {
    private final DailyProgressService service;

    public DailyProgressController(DailyProgressService service) {
        this.service = service;
    }

    @GetMapping
    public DailyProgressResponse today(@PathVariable UUID dietId) {
        return service.today(dietId);
    }
}
