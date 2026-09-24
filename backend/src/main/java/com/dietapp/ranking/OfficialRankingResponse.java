package com.dietapp.ranking;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record OfficialRankingResponse(UUID dietId, String status, LocalDate startDate,
                                     LocalDate endDate, LocalDate lastClosedDate,
                                     RankingCurrentUserResponse currentUser,
                                     List<RankingParticipantResponse> participants,
                                     RankingPageResponse page,
                                     RankingPodiumResponse podium) {
}
