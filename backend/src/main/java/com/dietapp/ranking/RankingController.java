package com.dietapp.ranking;

import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.RequestParam;
import com.dietapp.common.Pagination;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/diets/{dietId}/ranking")
public class RankingController {
    private final RankingService service;

    public RankingController(RankingService service) {
        this.service = service;
    }

    @GetMapping
    public OfficialRankingResponse list(@PathVariable UUID dietId,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return service.list(dietId, Pagination.request(page, size));
    }

    @GetMapping("/me")
    public RankingDetailsResponse details(@PathVariable UUID dietId,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return service.details(dietId, Pagination.request(page, size));
    }

    @GetMapping("/activity")
    public RankingActivityResponse activity(@PathVariable UUID dietId) {
        return service.latestActivity(dietId);
    }
}
