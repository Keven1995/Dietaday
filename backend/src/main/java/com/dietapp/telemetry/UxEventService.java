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
    private static final Set<String> ALLOWED_EVENTS = Set.of(
            "meal_created",
            "water_logged",
            "daily_goal_completed",
            "hydration_goal_completed",
            "reaction_created",
            "ranking_position_changed",
            "streak_incremented");

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
        if (!members.existsByDietIdAndUserId(request.dietId(), currentUser.id())) {
            throw new ForbiddenException("The user is not a member of this diet");
        }
        if (events.existsByEventIdAndUserId(request.eventId(), currentUser.id())) return;

        String details = serializeDetails(request.details());
        events.save(new UxEvent(request.eventId(), request.eventName(), currentUser.id(), request.dietId(), details));
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
