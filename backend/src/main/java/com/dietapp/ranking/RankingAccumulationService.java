package com.dietapp.ranking;

import com.dietapp.diet.DietMember;
import com.dietapp.user.User;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RankingAccumulationService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RankingScoreRepository scores;
    private final RankingDailyPositionRepository positions;
    private final Clock clock;

    public RankingAccumulationService(RankingScoreRepository scores,
                                      RankingDailyPositionRepository positions,
                                      Clock clock) {
        this.scores = scores;
        this.positions = positions;
        this.clock = clock;
    }

    public void accumulate(DailyRankingClosure closure, List<DailyRankingTotal> dailyTotals,
                           List<DietMember> members) {
        Map<java.util.UUID, DailyRankingTotal> totalsByUser = new HashMap<>();
        dailyTotals.forEach(total -> totalsByUser.put(total.getUser().getId(), total));
        List<RankingScore> rankingScores = new ArrayList<>();
        Instant reachedAt = closure.getClosedAt() != null ? closure.getClosedAt() : Instant.now(clock);

        for (DietMember member : members) {
            User user = member.getUser();
            RankingScore score = scores.findByDietIdAndUserId(closure.getDiet().getId(), user.getId())
                    .orElseGet(() -> new RankingScore(closure.getDiet(), user, RANDOM.nextLong()));
            DailyRankingTotal total = totalsByUser.get(user.getId());
            if (total != null) score.addDailyPoints(total.getPoints(), reachedAt);
            rankingScores.add(score);
        }

        scores.saveAll(rankingScores);
        List<RankingParticipant> ordered = RankingOrderingPolicy.sort(rankingScores.stream()
                .map(score -> new RankingParticipant(score.getUser().getId(), score.getPoints(),
                        score.getActiveDays(), score.getFirstReachedAt(), score.getInitialOrder()))
                .toList());
        Map<java.util.UUID, RankingScore> scoreByUser = new HashMap<>();
        rankingScores.forEach(score -> scoreByUser.put(score.getUser().getId(), score));
        List<RankingDailyPosition> dailyPositions = new ArrayList<>();
        for (int index = 0; index < ordered.size(); index++) {
            RankingScore score = scoreByUser.get(ordered.get(index).userId());
            dailyPositions.add(new RankingDailyPosition(closure, score.getUser(), index + 1,
                    score.getPoints(), score.getActiveDays(), score.getFirstReachedAt()));
        }
        positions.saveAll(dailyPositions);
    }
}
