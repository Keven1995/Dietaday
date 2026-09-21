package com.dietapp.water;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class WaterReminderSchedule {
    public static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final Duration GRACE_WINDOW = Duration.ofMinutes(2);
    private static final List<LocalTime> TIMES = List.of(
            LocalTime.of(9, 0),
            LocalTime.of(13, 0),
            LocalTime.of(16, 0),
            LocalTime.of(18, 0),
            LocalTime.of(20, 0));

    public Optional<String> slotAt(Instant instant) {
        return slotAt(instant.atZone(BRASILIA));
    }

    public Optional<String> slotAt(ZonedDateTime dateTime) {
        LocalTime current = dateTime.withZoneSameInstant(BRASILIA).toLocalTime();
        return TIMES.stream()
                .filter(slot -> !current.isBefore(slot) && current.isBefore(slot.plus(GRACE_WINDOW)))
                .map(LocalTime::toString)
                .findFirst();
    }

    public List<LocalTime> times() {
        return TIMES;
    }
}
