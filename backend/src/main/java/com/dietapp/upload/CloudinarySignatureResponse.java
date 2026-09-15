package com.dietapp.upload;

public record CloudinarySignatureResponse(
        String cloudName,
        String apiKey,
        long timestamp,
        String signature,
        String uploadUrl) {
}
