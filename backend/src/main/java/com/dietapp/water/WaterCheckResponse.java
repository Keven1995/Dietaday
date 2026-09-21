package com.dietapp.water;

import java.time.Instant;
import java.util.UUID;

public record WaterCheckResponse(UUID id, int amountMl, Instant createdAt) {
    static WaterCheckResponse from(WaterCheck check) {
        return new WaterCheckResponse(check.getId(), check.getAmountMl(), check.getCreatedAt());
    }
}
