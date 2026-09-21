package com.dietapp.water;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class WaterReminderScheduleTest {
    private static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");
    private final WaterReminderSchedule schedule = new WaterReminderSchedule();

    @Test
    void recognizesConfiguredTimesInBrasilia() {
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 9, 21, 9, 0, 0, 0, BRASILIA))).contains("09:00");
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 9, 21, 13, 0, 0, 0, BRASILIA))).contains("13:00");
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 9, 21, 20, 0, 0, 0, BRASILIA))).contains("20:00");
    }

    @Test
    void ignoresOtherTimesAndAllowsShortSchedulerGraceWindow() {
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 9, 21, 12, 59, 0, 0, BRASILIA))).isEmpty();
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 9, 21, 9, 1, 30, 0, BRASILIA))).contains("09:00");
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 9, 21, 9, 3, 0, 0, BRASILIA))).isEmpty();
    }

    @Test
    void convertsInstantUsingBrasiliaRatherThanServerTimezone() {
        Instant instant = ZonedDateTime.of(2026, 9, 21, 12, 0, 0, 0, ZoneId.of("UTC")).toInstant();
        assertThat(schedule.slotAt(instant)).contains("09:00");
    }
}
