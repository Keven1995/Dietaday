package com.dietapp.telemetry;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.security.CurrentUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UxEventServiceTest {
    private final UxEventRepository events = mock(UxEventRepository.class);
    private final DietMemberRepository members = mock(DietMemberRepository.class);
    private final CurrentUser currentUser = mock(CurrentUser.class);
    private final UxEventService service = new UxEventService(events, members, currentUser, new ObjectMapper());
    private final UUID userId = UUID.randomUUID();
    private final UUID dietId = UUID.randomUUID();

    @Test
    void recordsAllowedEventForDietMember() {
        when(currentUser.id()).thenReturn(userId);
        when(members.existsByDietIdAndUserId(dietId, userId)).thenReturn(true);
        when(events.existsByEventIdAndUserId("water:1", userId)).thenReturn(false);

        assertDoesNotThrow(() -> service.record(new UxEventRequest(
                "water_logged", "water:1", dietId, Map.of("amountMl", 250))));

        verify(events).save(any(UxEvent.class));
    }

    @Test
    void ignoresDuplicateEventForSameUser() {
        when(currentUser.id()).thenReturn(userId);
        when(members.existsByDietIdAndUserId(dietId, userId)).thenReturn(true);
        when(events.existsByEventIdAndUserId("water:1", userId)).thenReturn(true);

        service.record(new UxEventRequest("water_logged", "water:1", dietId, Map.of()));

        verify(events, never()).save(any(UxEvent.class));
    }

    @Test
    void rejectsUnsupportedEvent() {
        assertThrows(BadRequestException.class, () -> service.record(
                new UxEventRequest("animation_started", "animation:1", dietId, Map.of())));
    }

    @Test
    void rejectsUserOutsideDiet() {
        when(currentUser.id()).thenReturn(userId);
        when(members.existsByDietIdAndUserId(dietId, userId)).thenReturn(false);

        assertThrows(ForbiddenException.class, () -> service.record(
                new UxEventRequest("water_logged", "water:1", dietId, Map.of())));
    }
}
