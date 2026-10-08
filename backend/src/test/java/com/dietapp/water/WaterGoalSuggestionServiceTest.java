package com.dietapp.water;

import com.dietapp.user.User;
import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class WaterGoalSuggestionServiceTest {
    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-10-09T02:30:00Z"), ZoneId.of("UTC"));
    private final WaterGoalSuggestionService suggestions = new WaterGoalSuggestionService(CLOCK);

    @Test
    void suggestsAnAdultGoalFromWeightRoundedToFiftyMl() {
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(2008, 10, 8), "70.00")))
                .isEqualTo(2450);
    }

    @Test
    void doesNotSuggestForSomeoneWhoHasNotReachedEighteenYetInSaoPaulo() {
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(2008, 10, 9), "70.00")))
                .isNull();
    }

    @Test
    void doesNotSuggestWhenWeightOrBirthDateIsMissing() {
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(1990, 1, 1), null))).isNull();
        assertThat(suggestions.suggestedGoalMl(user(null, "70.00"))).isNull();
    }

    @Test
    void roundsExactHalfStepsUpDeterministically() {
        assertThat(WaterGoalSuggestionService.roundToNearest50Ml(new BigDecimal("2425"))).isEqualTo(2450);
        assertThat(WaterGoalSuggestionService.roundToNearest50Ml(new BigDecimal("2424.99"))).isEqualTo(2400);
    }

    @Test
    void onlyReturnsRoundedSuggestionsWithinTheAllowedGoalRange() {
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(1990, 1, 1), "57.14"))).isEqualTo(2000);
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(1990, 1, 1), "55.00"))).isNull();
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(1990, 1, 1), "114.28"))).isEqualTo(4000);
        assertThat(suggestions.suggestedGoalMl(user(LocalDate.of(1990, 1, 1), "115.00"))).isNull();
    }

    private User user(LocalDate birthDate, String weightKg) {
        User user = new User("suggestion@example.test", "hash", "Suggestion User", UserSex.FEMALE, birthDate);
        if (weightKg != null) {
            user.updateProfile(user.getFullName(), new BigDecimal(weightKg), 170, UserSex.FEMALE, birthDate);
        }
        return user;
    }
}
