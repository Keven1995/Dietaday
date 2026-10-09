package com.dietapp.nudge;

import com.dietapp.common.BadRequestException;

import java.util.List;

/** Immutable catalog for the six official meal types and their fixed MVP messages. */
public enum MealNudgeType {
    BREAKFAST("Café da manhã", "WHERE_IS_BREAKFAST", "👀 Cadê o café da manhã?",
            "O café da manhã foi tomar café sozinho? Cadê o registro? ☕😂"),
    MORNING_SNACK("Lanche da manhã", "WHERE_IS_MORNING_SNACK", "👀 Cadê o lanche da manhã?",
            "E esse lanchinho da manhã, tá em missão secreta? 🍎🕵️"),
    LUNCH("Almoço", "WHERE_IS_LUNCH", "👀 Cadê o almoço?",
            "Tá comendo escondido aí? 😂"),
    AFTERNOON_SNACK("Lanche da tarde", "WHERE_IS_AFTERNOON_SNACK", "👀 Cadê o lanche da tarde?",
            "A tarde chegou e o lanche sumiu! Cadê as provas? 🥪👀"),
    DINNER("Jantar", "WHERE_IS_DINNER", "👀 Cadê o jantar?",
            "E o jantar, foi abduzido ou você esqueceu de postar? 🛸🍽️"),
    SUPPER("Ceia", "WHERE_IS_SUPPER", "👀 Cadê a ceia?",
            "A fiscalização noturna passou: cadê a ceia? 🌙😂");

    private final String label;
    private final String messageKey;
    private final String buttonLabel;
    private final String message;

    MealNudgeType(String label, String messageKey, String buttonLabel, String message) {
        this.label = label;
        this.messageKey = messageKey;
        this.buttonLabel = buttonLabel;
        this.message = message;
    }

    public String label() { return label; }
    public String messageKey() { return messageKey; }
    public String buttonLabel() { return buttonLabel; }
    public String message() { return message; }

    public List<String> storedMealTypeValues() {
        // The Portuguese label is the persisted value. Include the canonical API key for legacy rows.
        return List.of(label, name());
    }

    public static MealNudgeType fromApiValue(String value) {
        if (value == null) throw new BadRequestException("Informe o tipo de refeição.");
        try {
            return valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Tipo de refeição não suportado.");
        }
    }
}
