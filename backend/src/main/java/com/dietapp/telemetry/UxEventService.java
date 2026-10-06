package com.dietapp.telemetry;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.security.CurrentUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

@Service
public class UxEventService {
    private static final int MAX_DETAIL_LENGTH = 2000;
    private static final Set<String> DIET_OPTIONAL_EVENTS = Set.of(
            "feature_hint_viewed",
            "feature_hint_clicked",
            "feature_hint_dismissed",
            "feature_adopted",
            "meal_form_started",
            "meal_saved_locally");
    private static final Set<String> FEATURE_HINT_EVENTS = Set.of(
            "feature_hint_viewed",
            "feature_hint_clicked",
            "feature_hint_dismissed",
            "feature_adopted");
    private static final Set<String> FEATURE_CAMPAIGNS = Set.of(
            "share_diet",
            "discover_hydration",
            "water_reminders",
            "competitive_ranking",
            "social_interactions");
    private static final Set<String> FEATURE_HINT_PAGES = Set.of(
            "/", "/dietas", "/historico", "/refeicoes/nova", "/membros", "/perfil", "/agua", "/ranking");
    private static final Set<String> FEATURE_HINT_DETAIL_KEYS = Set.of("campaign", "version", "page", "exposureId");
    private static final Set<String> MEAL_FORM_DETAIL_KEYS = Set.of("formSessionId");
    private static final Set<String> ALLOWED_EVENTS = Set.of(
            "meal_created",
            "water_logged",
            "daily_goal_completed",
            "hydration_goal_completed",
            "reaction_created",
            "ranking_position_changed",
            "streak_incremented",
            "feature_hint_viewed",
            "feature_hint_clicked",
            "feature_hint_dismissed",
            "feature_adopted",
            "meal_form_started",
            "meal_saved_locally");

    private final UxEventRepository events;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;
    private final ObjectMapper objectMapper;

    public UxEventService(UxEventRepository events, DietMemberRepository members,
                          CurrentUser currentUser, ObjectMapper objectMapper) {
        this.events = events;
        this.members = members;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void record(UxEventRequest request) {
        if (!ALLOWED_EVENTS.contains(request.eventName())) {
            throw new BadRequestException("Unsupported UX event");
        }
        if (request.dietId() == null && !DIET_OPTIONAL_EVENTS.contains(request.eventName())) {
            throw new BadRequestException("dietId is required for this UX event");
        }
        validateDiscoveryDetails(request);
        if (request.dietId() != null && !members.existsByDietIdAndUserId(request.dietId(), currentUser.id())) {
            throw new ForbiddenException("The user is not a member of this diet");
        }
        if (events.existsByEventIdAndUserId(request.eventId(), currentUser.id())) return;

        String details = serializeDetails(request.details());
        events.save(new UxEvent(request.eventId(), request.eventName(), currentUser.id(), request.dietId(), details));
    }

    private void validateDiscoveryDetails(UxEventRequest request) {
        if (FEATURE_HINT_EVENTS.contains(request.eventName())) {
            Map<String, Object> details = requireAllowedDetails(request.details(), FEATURE_HINT_DETAIL_KEYS);
            String campaign = requireText(details, "campaign", 64);
            if (!FEATURE_CAMPAIGNS.contains(campaign)) {
                throw new BadRequestException("Unsupported feature campaign");
            }
            Object version = details.get("version");
            if (!(version instanceof Number number) || number.doubleValue() != number.intValue() || number.intValue() < 1) {
                throw new BadRequestException("Feature campaign version is invalid");
            }
            String page = requireText(details, "page", 128);
            if (!FEATURE_HINT_PAGES.contains(page)) throw new BadRequestException("Unsupported feature hint page");
            requireUuid(details, "exposureId");
            return;
        }
        if ("meal_form_started".equals(request.eventName()) || "meal_saved_locally".equals(request.eventName())) {
            Map<String, Object> details = requireAllowedDetails(request.details(), MEAL_FORM_DETAIL_KEYS);
            requireUuid(details, "formSessionId");
        }
    }

    private Map<String, Object> requireAllowedDetails(Map<String, Object> details, Set<String> allowedKeys) {
        if (details == null || !details.keySet().equals(allowedKeys)) {
            throw new BadRequestException("UX event details do not match the event contract");
        }
        return details;
    }

    private String requireText(Map<String, Object> details, String key, int maxLength) {
        Object value = details.get(key);
        if (!(value instanceof String text) || text.isBlank() || text.length() > maxLength) {
            throw new BadRequestException("UX event detail is invalid: " + key);
        }
        return text;
    }

    private void requireUuid(Map<String, Object> details, String key) {
        String value = requireText(details, key, 128);
        try {
            java.util.UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("UX event detail is invalid: " + key);
        }
    }

    private String serializeDetails(Map<String, Object> details) {
        if (details == null || details.isEmpty()) return "{}";
        if (details.keySet().stream().anyMatch(key -> key == null || key.length() > 48)) {
            throw new BadRequestException("UX event detail key is too long");
        }
        try {
            String serialized = objectMapper.writeValueAsString(details);
            if (serialized.length() > MAX_DETAIL_LENGTH) {
                throw new BadRequestException("UX event details are too large");
            }
            return serialized;
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("UX event details are invalid");
        }
    }
}
