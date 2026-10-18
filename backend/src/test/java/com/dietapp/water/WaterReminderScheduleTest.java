package com.dietapp.water;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.stream.Stream;

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

    @ParameterizedTest
    @MethodSource("configuredSlots")
    void recognizesAllFiveConfiguredSlots(LocalTime time, String expectedSlot) {
        assertThat(schedule.slotAt(ZonedDateTime.of(2026, 10, 18, time.getHour(), time.getMinute(), 0, 0, BRASILIA)))
                .contains(expectedSlot);
    }

    @ParameterizedTest
    @MethodSource("configuredSlots")
    void includesStartAndLastSecondButExcludesTwoMinuteBoundary(LocalTime time, String expectedSlot) {
        ZonedDateTime start = ZonedDateTime.of(2026, 10, 18, time.getHour(), time.getMinute(), 0, 0, BRASILIA);
        assertThat(schedule.slotAt(start.minusNanos(1))).isEmpty();
        assertThat(schedule.slotAt(start)).contains(expectedSlot);
        assertThat(schedule.slotAt(start.plusSeconds(119).plusNanos(999_999_999))).contains(expectedSlot);
        assertThat(schedule.slotAt(start.plusSeconds(120))).isEmpty();
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

    private static Stream<Arguments> configuredSlots() {
        return Stream.of(
                Arguments.of(LocalTime.of(9, 0), "09:00"),
                Arguments.of(LocalTime.of(13, 0), "13:00"),
                Arguments.of(LocalTime.of(16, 0), "16:00"),
                Arguments.of(LocalTime.of(18, 0), "18:00"),
                Arguments.of(LocalTime.of(20, 0), "20:00"));
    }
}
