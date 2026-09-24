package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.dietapp.security.SecurityAuditService;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class RankingFinalizationService {
    private final DietRepository diets;
    private final RankingScoreRepository scores;
    private final RankingFinalizationRepository finalizations;
    private final Clock clock;
    private final SecurityAuditService audit;

    public RankingFinalizationService(DietRepository diets, RankingScoreRepository scores,
                                      RankingFinalizationRepository finalizations, Clock clock,
                                      SecurityAuditService audit) {
        this.diets = diets;
        this.scores = scores;
        this.finalizations = finalizations;
        this.clock = clock;
        this.audit = audit;
    }

    @Transactional
    public boolean finalizeIfEnded(java.util.UUID dietId) {
        long startedAt = System.nanoTime();
        Diet diet = diets.findForUpdateById(dietId).orElseThrow();
        LocalDate today = LocalDate.now(clock.withZone(DailyClosingCalculator.ZONE));
        if (!diet.isCompetitiveMode() || !today.isAfter(diet.getEndDate())) return false;
        if (finalizations.findByDietId(dietId).isPresent()) return false;

        List<RankingParticipant> ordered = RankingOrderingPolicy.sort(scores.findAllByDietId(dietId).stream()
                .map(score -> new RankingParticipant(score.getUser().getId(), score.getPoints(),
                        score.getActiveDays(), score.getFirstReachedAt(), score.getInitialOrder()))
                .toList());
        List<RankingScore> rankingScores = scores.findAllByDietId(dietId);
        java.util.Map<java.util.UUID, com.dietapp.user.User> users = rankingScores.stream()
                .collect(java.util.stream.Collectors.toMap(score -> score.getUser().getId(), RankingScore::getUser));
        RankingFinalization finalization = finalizations.save(new RankingFinalization(diet, Instant.now(clock),
                userAt(ordered, 0, users), userAt(ordered, 1, users), userAt(ordered, 2, users)));
        audit.rankingFinalized(dietId, finalization.getId(), (System.nanoTime() - startedAt) / 1_000_000);
        return true;
    }

    private com.dietapp.user.User userAt(List<RankingParticipant> ordered, int index,
                                         java.util.Map<java.util.UUID, com.dietapp.user.User> users) {
        return ordered.size() > index ? users.get(ordered.get(index).userId()) : null;
    }
}
