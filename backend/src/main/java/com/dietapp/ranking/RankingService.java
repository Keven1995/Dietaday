package com.dietapp.ranking;

import com.dietapp.common.ConflictException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.diet.DietService;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RankingService {
    private final DietService diets;
    private final CurrentUser currentUser;
    private final DietMemberRepository members;
    private final RankingScoreRepository scores;
    private final DailyRankingClosureRepository closures;
    private final RankingFinalizationRepository finalizations;
    private final RankingPointEventRepository events;

    public RankingService(DietService diets, CurrentUser currentUser, DietMemberRepository members,
                          RankingScoreRepository scores, DailyRankingClosureRepository closures,
                          RankingFinalizationRepository finalizations, RankingPointEventRepository events) {
        this.diets = diets;
        this.currentUser = currentUser;
        this.members = members;
        this.scores = scores;
        this.closures = closures;
        this.finalizations = finalizations;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public OfficialRankingResponse list(UUID dietId, Pageable pageable) {
        Diet diet = diets.requireMember(dietId);
        if (!diet.isCompetitiveMode()) throw new ConflictException("This diet is not competitive");
        UUID currentUserId = currentUser.id();
        List<RankingParticipant> ordered = rankingParticipants(dietId);
        Map<UUID, RankingScore> scoreByUser = scores.findAllByDietId(dietId).stream()
                .collect(Collectors.toMap(score -> score.getUser().getId(), score -> score));
        int from = Math.min((int) pageable.getOffset(), ordered.size());
        int to = Math.min(from + pageable.getPageSize(), ordered.size());
        List<RankingParticipantResponse> participants = new ArrayList<>();
        for (int index = from; index < to; index++) {
            RankingParticipant participant = ordered.get(index);
            RankingScore score = scoreByUser.get(participant.userId());
            participants.add(new RankingParticipantResponse(index + 1, participant.userId(),
                    score == null ? memberName(dietId, participant.userId()) : score.getUser().getFullName(),
                    participant.points(), participant.activeDays(), participant.firstReachedAt()));
        }

        RankingParticipant current = ordered.stream()
                .filter(participant -> participant.userId().equals(currentUserId))
                .findFirst().orElse(new RankingParticipant(currentUserId, 0, 0, null, Long.MAX_VALUE));
        int currentPosition = ordered.indexOf(current) + 1;
        List<RankingPointEvent> pending = pendingEvents(dietId, currentUserId);
        int pendingPoints = pending.stream().mapToInt(RankingPointEvent::getPoints).sum();
        LocalDate lastClosedDate = closures.findTopByDietIdOrderByEventDateDesc(dietId)
                .map(DailyRankingClosure::getEventDate).orElse(null);
        RankingFinalization finalization = finalizations.findByDietId(dietId).orElse(null);
        RankingPodiumResponse podium = finalization == null ? null : new RankingPodiumResponse(
                id(finalization.getFirst()), id(finalization.getSecond()), id(finalization.getThird()));
        return new OfficialRankingResponse(dietId, finalization == null ? "ACTIVE" : "FINALIZED",
                diet.getStartDate(), diet.getEndDate(), lastClosedDate,
                new RankingCurrentUserResponse(currentUserId, currentPosition, current.points(), pendingPoints),
                participants,
                new RankingPageResponse(pageable.getPageNumber(), pageable.getPageSize(), ordered.size(),
                        (ordered.size() + pageable.getPageSize() - 1) / pageable.getPageSize()),
                podium);
    }

    @Transactional(readOnly = true)
    public RankingDetailsResponse details(UUID dietId, Pageable pageable) {
        Diet diet = diets.requireMember(dietId);
        if (!diet.isCompetitiveMode()) throw new ConflictException("This diet is not competitive");
        UUID userId = currentUser.id();
        List<RankingPointEvent> pending = pendingEvents(dietId, userId);
        Map<String, Integer> mealCounts = new LinkedHashMap<>();
        for (CompetitiveMealType type : CompetitiveMealType.values()) mealCounts.put(mealTypeKey(type), 0);
        int waterChecks = 0;
        List<RankingEventResponse> allResponseEvents = new ArrayList<>();
        for (RankingPointEvent event : pending) {
            if (event.getSourceType() == RankingPointEvent.SourceType.MEAL) {
                String type = event.getMealType();
                for (CompetitiveMealType official : CompetitiveMealType.values()) {
                    if (official.label().equals(event.getMealType())) type = mealTypeKey(official);
                }
                mealCounts.computeIfPresent(type, (key, value) -> value + 1);
            } else if (event.getSourceType() == RankingPointEvent.SourceType.WATER_CHECK) {
                waterChecks++;
            }
            allResponseEvents.add(new RankingEventResponse(event.getSourceType().name(), event.getMealType(),
                    event.getEventDate(), event.getPoints(), event.getStatus().name()));
        }
        int from = Math.min((int) pageable.getOffset(), allResponseEvents.size());
        int to = Math.min(from + pageable.getPageSize(), allResponseEvents.size());
        return new RankingDetailsResponse(userId, pending.stream().mapToInt(RankingPointEvent::getPoints).sum(),
                mealCounts, waterChecks, allResponseEvents.subList(from, to),
                new RankingPageResponse(pageable.getPageNumber(), pageable.getPageSize(), allResponseEvents.size(),
                        (allResponseEvents.size() + pageable.getPageSize() - 1) / pageable.getPageSize()));
    }

    private List<RankingParticipant> rankingParticipants(UUID dietId) {
        Map<UUID, RankingScore> scoreByUser = scores.findAllByDietId(dietId).stream()
                .collect(Collectors.toMap(score -> score.getUser().getId(), score -> score));
        List<RankingParticipant> participants = new ArrayList<>();
        for (DietMember member : members.findAllByDietId(dietId)) {
            RankingScore score = scoreByUser.get(member.getUser().getId());
            participants.add(score == null
                    ? new RankingParticipant(member.getUser().getId(), 0, 0, null,
                    member.getUser().getId().getMostSignificantBits())
                    : new RankingParticipant(score.getUser().getId(), score.getPoints(), score.getActiveDays(),
                    score.getFirstReachedAt(), score.getInitialOrder()));
        }
        return RankingOrderingPolicy.sort(participants);
    }

    private List<RankingPointEvent> pendingEvents(UUID dietId, UUID userId) {
        LocalDate lastClosedDate = closures.findTopByDietIdOrderByEventDateDesc(dietId)
                .map(DailyRankingClosure::getEventDate).orElse(null);
        return events.findAllByDietIdAndUserIdAndStatusOrderByEventDateAscCreatedAtAsc(
                        dietId, userId, RankingPointEvent.Status.PENDING).stream()
                .filter(event -> lastClosedDate == null || event.getEventDate().isAfter(lastClosedDate))
                .toList();
    }

    private String memberName(UUID dietId, UUID userId) {
        return members.findAllByDietId(dietId).stream()
                .map(DietMember::getUser)
                .filter(user -> user.getId().equals(userId))
                .map(User::getFullName)
                .findFirst().orElse("");
    }

    private UUID id(User user) {
        return user == null ? null : user.getId();
    }

    private String mealTypeKey(CompetitiveMealType type) {
        return switch (type) {
            case BREAKFAST -> "CAFE_DA_MANHA";
            case MORNING_SNACK -> "LANCHE_DA_MANHA";
            case LUNCH -> "ALMOCO";
            case AFTERNOON_SNACK -> "LANCHE_DA_TARDE";
            case DINNER -> "JANTAR";
            case SUPPER -> "CEIA";
        };
    }
}
