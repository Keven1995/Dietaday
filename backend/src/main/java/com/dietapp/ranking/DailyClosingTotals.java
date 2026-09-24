package com.dietapp.ranking;

import java.util.Map;
import java.util.UUID;

public record DailyClosingTotals(Map<UUID, ParticipantTotals> participants) {
    public DailyClosingTotals {
        participants = Map.copyOf(participants);
    }

    public record ParticipantTotals(int meals, int waterChecks, int points) {
    }
}
