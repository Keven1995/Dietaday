package com.dietapp;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class DietMealTypeMigrationTest {
    private static final List<String> DEFAULT_MEAL_TYPES = List.of(
            "Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia");

    @Test
    void backfillsExistingDietsWithAllMealTypesAndTheirOwner() throws Exception {
        String databaseName = "diet_meal_types_migration_" + UUID.randomUUID().toString().replace("-", "");
        var dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:" + databaseName + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
                "sa", "");

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("32"))
                .load()
                .migrate();

        UUID ownerId = UUID.randomUUID();
        UUID dietId = UUID.randomUUID();
        LocalDate startDate = LocalDate.of(2026, 10, 8);
        insertUser(dataSource, ownerId);
        insertDiet(dataSource, dietId, startDate);
        insertOwnerMembership(dataSource, dietId, ownerId);

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        assertThat(readMealTypes(dataSource, dietId)).containsExactlyInAnyOrderElementsOf(DEFAULT_MEAL_TYPES);
        assertThat(readUpdatedBy(dataSource, dietId)).containsOnly(ownerId);
        assertThat(readEffectiveDates(dataSource, dietId)).containsOnly(startDate);
    }

    private void insertUser(DriverManagerDataSource dataSource, UUID userId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO app_users (id, email, password_hash, full_name, created_at)
                     VALUES (?, ?, 'test-hash', 'Migration Owner', CURRENT_TIMESTAMP)
                     """)) {
            statement.setObject(1, userId);
            statement.setString(2, userId + "@example.test");
            statement.executeUpdate();
        }
    }

    private void insertDiet(DriverManagerDataSource dataSource, UUID dietId, LocalDate startDate) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO diets (id, name, start_date, end_date, created_at)
                     VALUES (?, 'Existing diet', ?, ?, CURRENT_TIMESTAMP)
                     """)) {
            statement.setObject(1, dietId);
            statement.setObject(2, startDate);
            statement.setObject(3, startDate.plusDays(6));
            statement.executeUpdate();
        }
    }

    private void insertOwnerMembership(DriverManagerDataSource dataSource, UUID dietId, UUID ownerId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO diet_members (id, diet_id, user_id, role, joined_at)
                     VALUES (?, ?, ?, 'OWNER', CURRENT_TIMESTAMP)
                     """)) {
            statement.setObject(1, UUID.randomUUID());
            statement.setObject(2, dietId);
            statement.setObject(3, ownerId);
            statement.executeUpdate();
        }
    }

    private List<String> readMealTypes(DriverManagerDataSource dataSource, UUID dietId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT meal_type FROM diet_meal_type_settings WHERE diet_id = ? ORDER BY meal_type")) {
            statement.setObject(1, dietId);
            try (ResultSet results = statement.executeQuery()) {
                var mealTypes = new ArrayList<String>();
                while (results.next()) mealTypes.add(results.getString(1));
                return mealTypes;
            }
        }
    }

    private List<UUID> readUpdatedBy(DriverManagerDataSource dataSource, UUID dietId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT DISTINCT updated_by FROM diet_meal_type_settings WHERE diet_id = ?")) {
            statement.setObject(1, dietId);
            try (ResultSet results = statement.executeQuery()) {
                var ids = new ArrayList<UUID>();
                while (results.next()) ids.add(results.getObject(1, UUID.class));
                return ids;
            }
        }
    }

    private List<LocalDate> readEffectiveDates(DriverManagerDataSource dataSource, UUID dietId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT DISTINCT effective_from FROM diet_meal_type_settings WHERE diet_id = ?")) {
            statement.setObject(1, dietId);
            try (ResultSet results = statement.executeQuery()) {
                var dates = new ArrayList<LocalDate>();
                while (results.next()) dates.add(results.getObject(1, LocalDate.class));
                return dates;
            }
        }
    }
}
