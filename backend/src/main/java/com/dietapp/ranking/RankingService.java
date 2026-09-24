package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RankingService {
    private final DietService diets;
    private final RankingPointEventRepository events;

    public RankingService(DietService diets, RankingPointEventRepository events) {
        this.diets = diets;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public Page<RankingEntryResponse> list(UUID dietId, Pageable pageable) {
        Diet diet = diets.requireMember(dietId);
        if (!diet.isCompetitiveMode()) throw new ConflictException("This diet is not competitive");
        Page<RankingPointEventRepository.RankingRow> rows = events.findRanking(dietId, pageable);
        AtomicInteger position = new AtomicInteger((int) pageable.getOffset() + 1);
        return rows.map(row -> new RankingEntryResponse(position.getAndIncrement(),
                row.getUserId(), row.getFullName(), row.getPoints(), row.getActiveDays()));
    }
}
