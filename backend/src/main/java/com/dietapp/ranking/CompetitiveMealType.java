package com.dietapp.ranking;

import java.util.Arrays;

public enum CompetitiveMealType {
    BREAKFAST("Café da manhã"),
    MORNING_SNACK("Lanche da manhã"),
    LUNCH("Almoço"),
    AFTERNOON_SNACK("Lanche da tarde"),
    DINNER("Jantar"),
    SUPPER("Ceia");

    private final String label;

    CompetitiveMealType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static boolean matchesLabel(String value) {
        return value != null && Arrays.stream(values()).anyMatch(type -> type.label.equals(value));
    }
}
