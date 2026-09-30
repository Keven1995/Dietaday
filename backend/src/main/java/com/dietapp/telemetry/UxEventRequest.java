package com.dietapp.telemetry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

public record UxEventRequest(
        @NotBlank @Size(max = 64) String eventName,
        @NotBlank @Size(max = 128) String eventId,
        @NotNull UUID dietId,
        @Size(max = 16) Map<String, Object> details) {
}
