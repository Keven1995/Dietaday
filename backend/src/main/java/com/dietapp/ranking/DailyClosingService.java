package com.dietapp.ranking;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.diet.DietRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.dietapp.security.SecurityAuditService;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DailyClosingService {
    private final DietRepository diets;
    private final DietMemberRepository members;
    private final RankingPointEventRepository events;
    private final DailyRankingClosureRepository closures;
    private final DailyRankingTotalRepository totals;
    private final RankingAccumulationService accumulation;
    private final DailyClosingCalculator calculator;
    private final Clock clock;
    private final SecurityAuditService audit;

    public DailyClosingService(DietRepository diets, DietMemberRepository members,
                               RankingPointEventRepository events,
                               DailyRankingClosureRepository closures,
                               DailyRankingTotalRepository totals,
                               RankingAccumulationService accumulation,
                               Clock clock, SecurityAuditService audit) {
        this.diets = diets;
        this.members = members;
        this.events = events;
        this.closures = closures;
        this.totals = totals;
        this.accumulation = accumulation;
        this.clock = clock;
        this.audit = audit;
        this.calculator = new DailyClosingCalculator(clock);
    }

    @Transactional
    public boolean closeDiet(UUID dietId, LocalDate eventDate) {
        long startedAt = System.nanoTime();
        Diet diet = diets.findForUpdateById(dietId).orElseThrow();
        if (!diet.isCompetitiveMode()
                || eventDate.isBefore(diet.getStartDate())
                || eventDate.isAfter(diet.getEndDate())) {
            return false;
        }
        if (closures.findByDietIdAndEventDate(dietId, eventDate).isPresent()) {
            return false;
        }

        try {
            Instant closedAt = Instant.now(clock);
            List<RankingPointEvent> pendingEvents = events.findAllByDietIdAndEventDateAndStatus(
                    dietId, eventDate, RankingPointEvent.Status.PENDING);
            DailyClosingTotals calculated = calculator.calculate(pendingEvents, eventDate);
            DailyRankingClosure closure = closures.saveAndFlush(new DailyRankingClosure(diet, eventDate, closedAt));

            Map<UUID, DailyClosingTotals.ParticipantTotals> calculatedByUser = calculated.participants();
            List<DailyRankingTotal> snapshots = new ArrayList<>();
            List<DietMember> dietMembers = members.findAllByDietId(dietId);
            for (DietMember member : dietMembers) {
                DailyClosingTotals.ParticipantTotals participant = calculatedByUser.get(member.getUser().getId());
                if (participant == null) {
                    participant = new DailyClosingTotals.ParticipantTotals(0, 0, 0);
                }
                snapshots.add(new DailyRankingTotal(closure, member.getUser(), participant.meals(),
                        participant.waterChecks(), participant.points()));
            }
            totals.saveAll(snapshots);
            accumulation.accumulate(closure, snapshots, dietMembers);

            pendingEvents.forEach(event -> event.settle(closedAt));
            events.saveAll(pendingEvents);
            audit.rankingDayClosed(dietId, closure.getId(), eventDate.toString(), pendingEvents.size(), elapsedMs(startedAt));
            return true;
        } catch (RuntimeException exception) {
            audit.rankingDayCloseFailed(dietId, eventDate.toString(), elapsedMs(startedAt));
            throw exception;
        }
    }

    private long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
