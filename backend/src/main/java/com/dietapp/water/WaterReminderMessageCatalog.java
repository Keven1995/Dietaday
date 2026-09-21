package com.dietapp.water;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class WaterReminderMessageCatalog {
    private static final List<String> MALE_MESSAGES = List.of(
            "Já tomou água hoje, %s? 💧 Lembre-se: só fica gostoso quem toma bastante água durante o dia 😉",
            "Não esquece da água do dia, %s 💦 Nosso corpo precisa de bastante água para não ficar retido.",
            "Tu já bebeu água hoje, %s? 🥤 Já já teu rim tá cheio de pedra 😅",
            "Não acredito que você esqueceu de tomar água hoje, %s. Ainda bem que eu estou aqui, né? VAI BEBER ÁGUA! 🚰",
            "Você conhece a tal da pedra no rim, %s? 🪨 Se eu fosse você, não queria conhecer... BEBE ÁGUA! 💧");
    private static final List<String> FEMALE_MESSAGES = List.of(
            "Já tomou água hoje, %s? 💧 Lembre-se: só fica gostosa quem toma bastante água durante o dia 😉",
            "Não esquece da água do dia, %s 💦 Nosso corpo precisa de bastante água para não ficar retido.",
            "Tu já bebeu água hoje, %s? 🥤 Já já teu rim tá cheio de pedra 😅",
            "Não acredito que você esqueceu de tomar água hoje, %s. Ainda bem que eu estou aqui, né? VAI BEBER ÁGUA! 🚰",
            "Você conhece a tal da pedra no rim, %s? 🪨 Se eu fosse você, não queria conhecer... BEBE ÁGUA! 💧",
            "Não acredito nisso não, Charlene, essas horas e não tomou um pingo d'água. Vai beber água! 💧",
            "Mulheeer, vai beber essa água. Tu vai ficar retida, acorda Charlene! 🚰");
    private static final List<String> NEUTRAL_MESSAGES = List.of(
            "Já tomou água hoje, %s? 💧 Lembre-se: hidratação faz bem durante o dia 😉",
            "Não esquece da água do dia, %s 💦 Nosso corpo precisa de bastante água.",
            "Tu já bebeu água hoje, %s? 🥤 Bora hidratar esse corpo! 😅",
            "Não acredito que você esqueceu de tomar água hoje, %s. Ainda bem que eu estou aqui, né? VAI BEBER ÁGUA! 🚰",
            "Você conhece a tal da pedra no rim, %s? 🪨 Melhor não conhecer... BEBE ÁGUA! 💧");

    public WaterReminderGender genderFor(String fullName) {
        String firstName = firstName(fullName);
        if (firstName.equals("keven")) return WaterReminderGender.MALE;
        if (firstName.equals("allana")) return WaterReminderGender.FEMALE;
        return WaterReminderGender.NEUTRAL;
    }

    public String messageFor(String fullName, WaterReminderGender gender, int index) {
        List<String> messages = switch (gender) {
            case MALE -> MALE_MESSAGES;
            case FEMALE -> FEMALE_MESSAGES;
            case NEUTRAL -> NEUTRAL_MESSAGES;
        };
        String name = firstName(fullName);
        String displayName = name.isEmpty() ? "você" : capitalize(name);
        return messages.get(Math.floorMod(index, messages.size())).formatted(displayName);
    }

    public int messageCount(WaterReminderGender gender) {
        return messagesFor(gender).size();
    }

    private String firstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "";
        String normalized = Normalizer.normalize(fullName.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        return normalized.split("\\s+")[0];
    }

    private List<String> messagesFor(WaterReminderGender gender) {
        return switch (gender) {
            case MALE -> MALE_MESSAGES;
            case FEMALE -> FEMALE_MESSAGES;
            case NEUTRAL -> NEUTRAL_MESSAGES;
        };
    }

    private String capitalize(String value) {
        return value.substring(0, 1).toUpperCase(Locale.forLanguageTag("pt-BR")) + value.substring(1);
    }
}
