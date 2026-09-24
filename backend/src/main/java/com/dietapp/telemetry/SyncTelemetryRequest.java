package com.dietapp.telemetry;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SyncTelemetryRequest(
        @NotNull UUID operationId,
        @NotNull UUID dietId,
        @NotBlank @Size(max = 32) String phase,
        @Min(1) @Max(1000) int attempt,
        @Min(0) @Max(900_000) Long durationMs,
        @Min(0) @Max(599) Integer httpStatus,
        @Size(max = 64) String errorType,
        @Size(max = 100) String fileType,
        @Min(0) @Max(50_000_000) Long fileSizeBytes) {
}
