package com.dietapp;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WaterGoalRangeMigrationTest {
    @Test
    void normalizesLegacyGoalsAndPreservesExistingChecks() throws Exception {
        String databaseName = "water_goal_migration_" + UUID.randomUUID().toString().replace("-", "");
        var dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:" + databaseName + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
                "sa", "");

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("24"))
                .load()
                .migrate();

        UUID lowGoalUserId = insertUser(dataSource, "low-goal", 1500);
        UUID validGoalUserId = insertUser(dataSource, "valid-goal", 3500);
        insertCheck(dataSource, lowGoalUserId);

        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .load()
                .migrate();

        assertThat(readGoal(dataSource, lowGoalUserId)).isEqualTo(2000);
        assertThat(readGoal(dataSource, validGoalUserId)).isEqualTo(3500);
        assertThat(readCheckCount(dataSource, lowGoalUserId)).isEqualTo(1);
        assertThat(readDailyGoalCount(dataSource, lowGoalUserId)).isZero();
    }

    private UUID insertUser(DriverManagerDataSource dataSource, String suffix, int goalMl) throws Exception {
        UUID id = UUID.randomUUID();
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO app_users (id, email, password_hash, full_name, daily_water_goal_ml,
                                            sex, created_at, email_verified)
                     VALUES (?, ?, 'test-hash', 'Migration User', ?, 'MALE', CURRENT_TIMESTAMP, TRUE)
                     """)) {
            statement.setObject(1, id);
            statement.setString(2, suffix + "@example.test");
            statement.setInt(3, goalMl);
            statement.executeUpdate();
        }
        return id;
    }

    private void insertCheck(DriverManagerDataSource dataSource, UUID userId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO water_checks (id, user_id, amount_ml, check_date, created_at)
                     VALUES (?, ?, 500, ?, CURRENT_TIMESTAMP)
                     """)) {
            statement.setObject(1, UUID.randomUUID());
            statement.setObject(2, userId);
            statement.setObject(3, LocalDate.of(2026, 10, 8));
            statement.executeUpdate();
        }
    }

    private int readGoal(DriverManagerDataSource dataSource, UUID userId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT daily_water_goal_ml FROM app_users WHERE id = ?")) {
            statement.setObject(1, userId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new AssertionError("Migration user not found");
                return result.getInt(1);
            }
        }
    }

    private int readCheckCount(DriverManagerDataSource dataSource, UUID userId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT COUNT(*) FROM water_checks WHERE user_id = ?")) {
            statement.setObject(1, userId);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }

    private int readDailyGoalCount(DriverManagerDataSource dataSource, UUID userId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT COUNT(*) FROM water_daily_goals WHERE user_id = ?")) {
            statement.setObject(1, userId);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }
}
