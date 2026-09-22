package com.dietapp.water;

import com.dietapp.user.UserSex;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class WaterReminderMessageCatalogTest {
    private final WaterReminderMessageCatalog catalog = new WaterReminderMessageCatalog();

    @Test
    void mapsPersistedUserSexToMessageGender() {
        assertThat(catalog.genderFor(UserSex.MALE)).isEqualTo(WaterReminderGender.MALE);
        assertThat(catalog.genderFor(UserSex.FEMALE)).isEqualTo(WaterReminderGender.FEMALE);
        assertThat(catalog.genderFor(UserSex.NEUTRAL)).isEqualTo(WaterReminderGender.NEUTRAL);
    }

    @Test
    void createsPersonalizedMessageForEachSupportedGender() {
        assertThat(catalog.messageFor("Keven", WaterReminderGender.MALE, 0))
                .contains("Keven", "gostoso");
        assertThat(catalog.messageFor("Allana", WaterReminderGender.FEMALE, 0))
                .contains("Allana", "gostosa");
        assertThat(catalog.messageFor("Alex", WaterReminderGender.NEUTRAL, 0))
                .contains("Alex", "água");
    }

    @Test
    void exposesFiveMessagesWithEmojisWithoutRepeatingAnAdjacentChoice() {
        Set<String> messages = Set.of(
                catalog.messageFor("Keven", WaterReminderGender.MALE, 0),
                catalog.messageFor("Keven", WaterReminderGender.MALE, 1),
                catalog.messageFor("Keven", WaterReminderGender.MALE, 2),
                catalog.messageFor("Keven", WaterReminderGender.MALE, 3),
                catalog.messageFor("Keven", WaterReminderGender.MALE, 4));

        assertThat(messages).hasSize(5);
        assertThat(messages).allMatch(message -> message.matches(".*[^\\p{ASCII}].*"));
        assertThat(catalog.messageCount(WaterReminderGender.MALE)).isEqualTo(5);
        assertThat(catalog.messageCount(WaterReminderGender.FEMALE)).isEqualTo(7);
    }
}
