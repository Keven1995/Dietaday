package com.dietapp.water;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.annotation.Scheduled;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WaterReminderDeliveryServiceTest {
    private static final ZoneId BRASILIA = WaterReminderSchedule.BRASILIA;

    @Mock private PushNotificationService push;
    @Mock private WaterReminderDeliveryProcessor processor;

    private WaterReminderDeliveryService service;

    @ParameterizedTest
    @MethodSource("configuredSlots")
    void dispatchesToTransactionalProcessorOnlyDuringEachConfiguredWindow(LocalTime time, String slot) {
        Instant instant = ZonedDateTime.of(2026, 10, 18, time.getHour(), time.getMinute(), 30, 0, BRASILIA).toInstant();
        when(push.isConfigured()).thenReturn(true);
        service = serviceAt(instant);

        service.sendDueReminders();

        verify(processor).sendDueReminders(instant, slot);
    }

    @ParameterizedTest
    @MethodSource("outsideWindows")
    void doesNotStartDatabaseProcessingOutsideReminderWindows(Instant instant) {
        when(push.isConfigured()).thenReturn(true);
        service = serviceAt(instant);

        service.sendDueReminders();

        verify(push).isConfigured();
        verifyNoInteractions(processor);
    }

    @Test
    void doesNotStartDatabaseProcessingWhenVapidIsNotConfigured() {
        when(push.isConfigured()).thenReturn(false);
        service = serviceAt(ZonedDateTime.of(2026, 10, 18, 9, 0, 30, 0, BRASILIA).toInstant());

        service.sendDueReminders();

        verifyNoInteractions(processor);
    }

    @Test
    void retainsThirtySecondScheduledRate() throws NoSuchMethodException {
        Method method = WaterReminderDeliveryService.class.getMethod("sendDueReminders");

        assertThat(method.getAnnotation(Scheduled.class).fixedRate()).isEqualTo(30_000L);
    }

    private WaterReminderDeliveryService serviceAt(Instant instant) {
        return new WaterReminderDeliveryService(push, new WaterReminderSchedule(), processor,
                java.time.Clock.fixed(instant, ZoneId.of("UTC")));
    }

    private static Stream<Arguments> configuredSlots() {
        return Stream.of(
                Arguments.of(LocalTime.of(9, 0), "09:00"),
                Arguments.of(LocalTime.of(13, 0), "13:00"),
                Arguments.of(LocalTime.of(16, 0), "16:00"),
                Arguments.of(LocalTime.of(18, 0), "18:00"),
                Arguments.of(LocalTime.of(20, 0), "20:00"));
    }

    private static Stream<Arguments> outsideWindows() {
        return Stream.of(
                Arguments.of(ZonedDateTime.of(2026, 10, 18, 8, 59, 59, 0, BRASILIA).toInstant()),
                Arguments.of(ZonedDateTime.of(2026, 10, 18, 9, 2, 0, 0, BRASILIA).toInstant()),
                Arguments.of(ZonedDateTime.of(2026, 10, 18, 13, 2, 0, 0, BRASILIA).toInstant()),
                Arguments.of(ZonedDateTime.of(2026, 10, 18, 15, 0, 0, 0, BRASILIA).toInstant()),
                Arguments.of(ZonedDateTime.of(2026, 10, 18, 20, 2, 0, 0, BRASILIA).toInstant()));
    }
}
