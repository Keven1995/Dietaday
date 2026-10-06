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
    void recordsAuthenticatedFeatureHintWithoutDietContext() {
        when(currentUser.id()).thenReturn(userId);
        when(events.existsByEventIdAndUserId("hint:exposure-1", userId)).thenReturn(false);

        assertDoesNotThrow(() -> service.record(new UxEventRequest(
                "feature_hint_viewed", "hint:exposure-1", null,
                Map.of("campaign", "discover_hydration", "version", 1,
                        "page", "/", "exposureId", "00000000-0000-0000-0000-000000000001"))));

        verify(events).save(any(UxEvent.class));
        verify(members, never()).existsByDietIdAndUserId(any(), any());
    }

    @Test
    void requiresContextualDetailsAndRejectsUnapprovedFieldsForDiscoveryEvents() {
        assertThrows(BadRequestException.class, () -> service.record(new UxEventRequest(
                "feature_hint_viewed", "hint:missing", null, Map.of("campaign", "discover_hydration"))));
        assertThrows(BadRequestException.class, () -> service.record(new UxEventRequest(
                "feature_hint_viewed", "hint:pii", null,
                Map.of("campaign", "discover_hydration", "version", 1, "page", "/",
                        "exposureId", "exposure-2", "email", "person@example.com"))));
    }

    @Test
    void recordsMealFormEventsWithoutDietWhenSessionIdIsPresent() {
        when(currentUser.id()).thenReturn(userId);

        service.record(new UxEventRequest("meal_form_started", "form:started", null,
                Map.of("formSessionId", "00000000-0000-0000-0000-000000000001")));
        service.record(new UxEventRequest("meal_saved_locally", "form:saved", null,
                Map.of("formSessionId", "00000000-0000-0000-0000-000000000001")));

        verify(events, org.mockito.Mockito.times(2)).save(any(UxEvent.class));
        verify(members, never()).existsByDietIdAndUserId(any(), any());
    }

    @Test
    void rejectsMealFormEventsWithoutSessionId() {
        assertThrows(BadRequestException.class, () -> service.record(
                new UxEventRequest("meal_form_started", "form:missing", null, Map.of())));
    }

    @Test
    void requiresDietForDomainEvents() {
        assertThrows(BadRequestException.class, () -> service.record(new UxEventRequest(
                "meal_created", "meal:no-diet", null, Map.of())));
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
