package com.dietapp;

import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import com.dietapp.user.UserSex;
import com.dietapp.diet.DietRepository;
import com.dietapp.ranking.RankingPointEventRepository;
import com.dietapp.ranking.RankingPointEvent;
import com.dietapp.telemetry.SyncErrorEventRepository;
import com.dietapp.telemetry.UxEventRepository;
import com.dietapp.water.WaterCheck;
import com.dietapp.water.WaterCheckRepository;
import com.dietapp.water.WaterDailyGoal;
import com.dietapp.water.WaterDailyGoalRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.Map;
import java.util.List;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.YearMonth;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository users;
    @Autowired DietRepository diets;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired RankingPointEventRepository rankingEvents;
    @Autowired SyncErrorEventRepository syncErrors;
    @Autowired WaterCheckRepository waterChecks;
    @Autowired WaterDailyGoalRepository waterDailyGoals;
    @Autowired UxEventRepository uxEvents;

    @Test
    void healthEndpointIsPublic() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Content-Security-Policy",
                        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"));
    }

    @Test
    void readinessEndpointIsPublic() throws Exception {
        mvc.perform(get("/api/health/ready"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void competitiveModeIsConfiguredAtCreationAndCannotBeChanged() throws Exception {
        JsonNode user = register("Competitive User", "competitive-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        String response = mvc.perform(post("/api/diets")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Competitive Diet","startDate":"2026-09-01","endDate":"2026-09-30","competitiveMode":true}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.competitiveMode").value(true))
                .andReturn().getResponse().getContentAsString();
        String dietId = objectMapper.readTree(response).get("id").asText();

        mvc.perform(put("/api/diets/{dietId}", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Changed","startDate":"2026-09-01","endDate":"2026-09-30","competitiveMode":false}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void dietWithoutCompetitiveModeRemainsNonCompetitive() throws Exception {
        JsonNode user = register("Regular User", "regular-diet-" + UUID.randomUUID() + "@example.com");

        mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Regular Diet","startDate":"2026-09-01","endDate":"2026-09-30"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.competitiveMode").value(false));
    }

    @Test
    void dailyProgressCountsTheSixOfficialMealsAndCurrentStreak() throws Exception {
        JsonNode user = register("Progress User", "progress-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        String dietId = mvc.perform(post("/api/diets")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Progress Diet",
                                "startDate", today.minusDays(3).toString(),
                                "endDate", today.plusDays(3).toString()))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        dietId = objectMapper.readTree(dietId).get("id").asText();

        for (String mealType : new String[]{"Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"}) {
            mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                            .header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "mealType", mealType,
                                    "description", mealType + " confirmado",
                                    "mealDate", today.toString()))))
                    .andExpect(status().isCreated());
        }

        mvc.perform(get("/api/diets/{dietId}/progress", dietId).header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyGoal").value(6))
                .andExpect(jsonPath("$.completedMeals").value(6))
                .andExpect(jsonPath("$.dailyGoalCompleted").value(true))
                .andExpect(jsonPath("$.streakDays").value(1));
    }

    @Test
    void listEndpointsRejectOversizedPages() throws Exception {
        JsonNode user = register("Pagination User", "pagination-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(user, "Pagination Diet");
        String mealId = createMeal(user, dietId, "Pagination meal");
        String authorization = bearer(user);

        mvc.perform(get("/api/diets").param("size", "101").header("Authorization", authorization))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/diets/{dietId}/members", dietId).param("size", "101")
                        .header("Authorization", authorization))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/diets/{dietId}/meals", dietId).param("size", "101")
                        .header("Authorization", authorization))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .param("size", "101").header("Authorization", authorization))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/notifications").param("size", "101")
                        .header("Authorization", authorization))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/invitations").param("size", "101")
                        .header("Authorization", authorization))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ownMealStatusUsesCompleteHistoryAndExcludesOtherMembersMeals() throws Exception {
        JsonNode owner = register("Meal Status Owner", "meal-status-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Meal Status Member", "meal-status-member-" + UUID.randomUUID() + "@example.com");
        JsonNode outsider = register("Meal Status Outsider", "meal-status-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Meal Status Diet");
        joinDiet(owner, member, dietId, member.get("email").asText());

        mvc.perform(get("/api/diets/{dietId}/meals/mine/status", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(false));

        createMeal(member, dietId, "First member meal");
        mvc.perform(get("/api/diets/{dietId}/meals/mine/status", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(false));

        createMeal(owner, dietId, "Owner meal outside first page");
        createMeal(member, dietId, "Latest member meal");
        mvc.perform(get("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].authorId").value(member.get("userId").asText()));
        mvc.perform(get("/api/diets/{dietId}/meals/mine/status", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(true));
        mvc.perform(get("/api/diets/{dietId}/meals/mine/status", dietId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(true));
        mvc.perform(get("/api/diets/{dietId}/meals/mine/status", dietId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
    }

    @Test
    void socialDiscoveryStatusRecognizesCommentsAndReactionsFromAnotherMember() throws Exception {
        JsonNode owner = register("Social Discovery Owner", "social-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode commenter = register("Social Discovery Commenter", "social-commenter-" + UUID.randomUUID() + "@example.com");
        JsonNode reactor = register("Social Discovery Reactor", "social-reactor-" + UUID.randomUUID() + "@example.com");
        JsonNode outsider = register("Social Discovery Outsider", "social-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Social Discovery Diet");
        joinDiet(owner, commenter, dietId, commenter.get("email").asText());
        joinDiet(owner, reactor, dietId, reactor.get("email").asText());
        String mealId = createMeal(owner, dietId, "A member meal");

        for (JsonNode member : new JsonNode[]{commenter, reactor, owner}) {
            mvc.perform(get("/api/diets/{dietId}/meals/social/status", dietId)
                            .header("Authorization", bearer(member)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").value(false));
        }

        createComment(commenter, dietId, mealId, "Gostei desta refeição.");
        mvc.perform(get("/api/diets/{dietId}/meals/social/status", dietId)
                        .header("Authorization", bearer(commenter)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(true));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(reactor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/diets/{dietId}/meals/social/status", dietId)
                        .header("Authorization", bearer(reactor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(true));
        mvc.perform(get("/api/diets/{dietId}/meals/social/status", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(false));
        mvc.perform(get("/api/diets/{dietId}/meals/social/status", dietId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
    }

    @Test
    void socialDiscoveryStatusOnlyCountsInteractionsOnOtherMembersMeals() throws Exception {
        JsonNode owner = register("Social Own Meal Owner", "social-own-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Social Own Meal Member", "social-own-member-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Social Own Meal Diet");
        joinDiet(owner, member, dietId, member.get("email").asText());
        String ownMealId = createMeal(member, dietId, "Member authored meal");
        createComment(member, dietId, ownMealId, "Meu próprio registro.");

        mvc.perform(get("/api/diets/{dietId}/meals/social/status", dietId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(false));
    }

    @Test
    void authenticatedUsersCanRequestCloudinaryUploadSignature() throws Exception {
        JsonNode user = register("Upload User", "upload-" + UUID.randomUUID() + "@example.com");

        mvc.perform(post("/api/uploads/signature")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cloudName").value("test-cloud"))
                .andExpect(jsonPath("$.apiKey").value("test-key"))
                .andExpect(jsonPath("$.timestamp").isNumber())
                .andExpect(jsonPath("$.signature").isString())
                .andExpect(jsonPath("$.uploadUrl").value("https://api.cloudinary.com/v1_1/test-cloud/image/upload"));
    }

    @Test
    void mealRejectsPhotoUrlOutsideConfiguredCloudinary() throws Exception {
        JsonNode user = register("Photo User", "photo-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(user, "Photo Diet");

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"Almoço","description":"Refeição","mealDate":"2026-09-22","photoUrl":"https://evil.example/photo.jpg"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void authenticatedUsersCanReportSanitizedSyncTelemetry() throws Exception {
        JsonNode user = register("Telemetry User", "telemetry-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(user, "Telemetry Diet");

        mvc.perform(post("/api/telemetry/sync")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operationId":"00000000-0000-0000-0000-000000000001","dietId":"%s","phase":"cloudinary-upload","attempt":1,"durationMs":1200,"httpStatus":0,"errorType":"cloudinary-no-response","fileType":"image/webp","fileSizeBytes":1024}
                """.formatted(dietId)))
                .andExpect(status().isNoContent());
        assertThat(syncErrors.count()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void authenticatedDiscoveryTelemetrySupportsNoDietAndValidatesItsContract() throws Exception {
        JsonNode user = register("Feature Telemetry User", "feature-telemetry-" + UUID.randomUUID() + "@example.com");
        String eventId = "hint:" + UUID.randomUUID();
        String exposureId = UUID.randomUUID().toString();
        String request = objectMapper.writeValueAsString(Map.of(
                "eventName", "feature_hint_viewed",
                "eventId", eventId,
                "details", Map.of(
                        "campaign", "discover_hydration",
                        "version", 1,
                        "page", "/",
                        "exposureId", exposureId)));
        long eventsBefore = uxEvents.count();

        mvc.perform(post("/api/telemetry/ux")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isNoContent());
        assertThat(uxEvents.count()).isEqualTo(eventsBefore + 1);

        mvc.perform(post("/api/telemetry/ux")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventName":"meal_created","eventId":"meal:no-diet"}
                                """))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/telemetry/ux")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventName":"feature_hint_viewed","eventId":"hint:missing","details":{"campaign":"discover_hydration"}}
                                """))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/telemetry/ux")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedUsersCanRegisterAndRefreshPushSubscriptions() throws Exception {
        JsonNode user = register("Push User", "push-" + UUID.randomUUID() + "@example.com");
        String subscription = """
                {"endpoint":"https://push.example.test/subscription-1","p256dh":"public-key","auth":"auth-key"}
                """;

        mvc.perform(post("/api/push/subscriptions")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subscription))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/push/subscriptions")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subscription.replace("public-key", "rotated-key")))
                .andExpect(status().isNoContent());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/push/subscriptions")
                        .header("Authorization", bearer(user))
                        .param("endpoint", "https://push.example.test/subscription-1"))
                .andExpect(status().isNoContent());
    }

    @Test
    void waterGoalAndChecksAreScopedToTodayAndCannotExceedGoal() throws Exception {
        JsonNode user = register("Water User", "water-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);

        mvc.perform(get("/api/water/today").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2000))
                .andExpect(jsonPath("$.suggestedGoalMl").value(nullValue()))
                .andExpect(jsonPath("$.consumedMl").value(0));
        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2500));
        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":1500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consumedMl").value(1500))
                .andExpect(jsonPath("$.percentage").value(60));
        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":1500}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":1000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.percentage").value(100))
                .andExpect(jsonPath("$.remainingMl").value(0));
    }

    @Test
    void waterGoalsAreLimitedToTwoThroughFourLitersInFiftyMlSteps() throws Exception {
        JsonNode user = register("Water Goal Range User", "water-goal-range-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);

        for (int goalMl : new int[]{1950, 4050, 2451}) {
            mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"goalMl\":" + goalMl + "}"))
                    .andExpect(status().isBadRequest());
        }

        for (int goalMl : new int[]{2000, 2450, 4000}) {
            mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"goalMl\":" + goalMl + "}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.goalMl").value(goalMl));
        }
    }

    @Test
    void waterCheckCanRegisterTheExactRemainderBelowFiveHundredMl() throws Exception {
        JsonNode user = register("Water Remainder User", "water-remainder-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk());

        for (int index = 0; index < 4; index++) {
            mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                    .andExpect(status().isOk());
        }

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":450}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consumedMl").value(2450))
                .andExpect(jsonPath("$.remainingMl").value(0))
                .andExpect(jsonPath("$.percentage").value(100))
                .andExpect(jsonPath("$.checks.length()").value(5));

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":450}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reducingGoalBelowConsumedWaterPreservesChecksAndBlocksMoreEntries() throws Exception {
        JsonNode user = register("Reduced Water Goal User", "reduced-water-goal-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        UUID userId = UUID.fromString(user.get("userId").asText());
        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2500}"))
                .andExpect(status().isOk());
        for (int index = 0; index < 5; index++) {
            mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                    .andExpect(status().isOk());
        }

        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2000))
                .andExpect(jsonPath("$.consumedMl").value(2500))
                .andExpect(jsonPath("$.remainingMl").value(0))
                .andExpect(jsonPath("$.percentage").value(100))
                .andExpect(jsonPath("$.checks.length()").value(5));

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isBadRequest());
        assertThat(waterChecks.findByUserIdAndCheckDateOrderByCreatedAtAsc(
                userId, LocalDate.now(ZoneId.of("America/Sao_Paulo")))).hasSize(5);
    }

    @Test
    void waterCheckRejectsArbitraryAmountsBelowFiveHundredMl() throws Exception {
        JsonNode user = register("Water Invalid Remainder User",
                "water-invalid-remainder-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":450}"))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2350}"))
                .andExpect(status().isOk());
        for (int index = 0; index < 4; index++) {
            mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                    .andExpect(status().isOk());
        }

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":349}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":350}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consumedMl").value(2350))
                .andExpect(jsonPath("$.remainingMl").value(0));
    }

    @Test
    void competitiveWaterRemainderGetsOneRankingEventAndBlocksFollowingChecks() throws Exception {
        JsonNode owner = register("Competitive Remainder Owner",
                "competitive-remainder-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Competitive Remainder Diet");
        String authorization = bearer(owner);

        mvc.perform(put("/api/diets/{dietId}/water/goal", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk());
        for (int index = 0; index < 4; index++) {
            mvc.perform(post("/api/diets/{dietId}/water/checks", dietId)
                            .header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                    .andExpect(status().isOk());
        }

        String response = mvc.perform(post("/api/diets/{dietId}/water/checks", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":450}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consumedMl").value(2450))
                .andExpect(jsonPath("$.remainingMl").value(0))
                .andExpect(jsonPath("$.pointsEarned").value(2))
                .andReturn().getResponse().getContentAsString();
        String remainderCheckId = objectMapper.readTree(response).get("checks").get(4).get("id").asText();

        assertThat(rankingEvents.countByDietIdAndUserId(UUID.fromString(dietId),
                UUID.fromString(owner.get("userId").asText()))).isEqualTo(5);
        assertThat(rankingEvents.findBySourceTypeAndSourceId(RankingPointEvent.SourceType.WATER_CHECK,
                UUID.fromString(remainderCheckId)).orElseThrow().getPoints()).isEqualTo(2);
        mvc.perform(post("/api/diets/{dietId}/water/checks", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":450}"))
                .andExpect(status().isBadRequest());
        assertThat(rankingEvents.countByDietIdAndUserId(UUID.fromString(dietId),
                UUID.fromString(owner.get("userId").asText()))).isEqualTo(5);
    }

    @Test
    void dailyGoalSnapshotIsCreatedOnFirstCheckAndOnlyTodaysSnapshotChanges() throws Exception {
        JsonNode user = register("Daily Goal Snapshot User", "daily-goal-snapshot-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        UUID userId = UUID.fromString(user.get("userId").asText());
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isOk());
        WaterDailyGoal todaySnapshot = waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today)
                .orElseThrow();
        assertThat(todaySnapshot.getGoalMl()).isEqualTo(2000);

        var savedUser = users.findById(userId).orElseThrow();
        LocalDate yesterday = today.minusDays(1);
        waterDailyGoals.saveAndFlush(new WaterDailyGoal(savedUser, null, yesterday, 2200));

        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2450));

        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today).orElseThrow().getGoalMl())
                .isEqualTo(2450);
        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, yesterday).orElseThrow().getGoalMl())
                .isEqualTo(2200);
        assertThat(waterChecks.findByUserIdAndCheckDateOrderByCreatedAtAsc(userId, today)).hasSize(1);

        JsonNode goalOnlyUser = register("Goal Change Without Check User",
                "goal-only-snapshot-" + UUID.randomUUID() + "@example.com");
        UUID goalOnlyUserId = UUID.fromString(goalOnlyUser.get("userId").asText());
        mvc.perform(put("/api/water/goal").header("Authorization", bearer(goalOnlyUser))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk());
        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(goalOnlyUserId, today).orElseThrow().getGoalMl())
                .isEqualTo(2450);
        assertThat(waterChecks.findByUserIdAndCheckDateOrderByCreatedAtAsc(goalOnlyUserId, today)).isEmpty();
    }

    @Test
    void legacyChecksOnTheSnapshotStartDayKeepTheirGoalUnavailable() throws Exception {
        JsonNode user = register("Legacy Same-Day Check User",
                "legacy-same-day-check-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        UUID userId = UUID.fromString(user.get("userId").asText());
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        var savedUser = users.findById(userId).orElseThrow();
        waterChecks.saveAndFlush(new WaterCheck(savedUser, 500, today));

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isOk());

        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today)
                .orElseThrow().getGoalMl()).isNull();

        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk());
        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today)
                .orElseThrow().getGoalMl()).isNull();
    }

    @Test
    void concurrentChecksForOneUserCreateOnlyOneDailyGoalSnapshot() throws Exception {
        JsonNode user = register("Concurrent Snapshot User", "concurrent-snapshot-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        UUID userId = UUID.fromString(user.get("userId").asText());
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            var registerCheck = (java.util.concurrent.Callable<Integer>) () -> {
                ready.countDown();
                if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test did not start");
                return mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                                .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                        .andReturn().getResponse().getStatus();
            };
            Future<Integer> first = executor.submit(registerCheck);
            Future<Integer> second = executor.submit(registerCheck);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(waterChecks.findByUserIdAndCheckDateOrderByCreatedAtAsc(userId, today)).hasSize(2);
            assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today)
                    .orElseThrow().getGoalMl()).isEqualTo(2000);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void generalAndCompetitiveDailyGoalSnapshotsRemainIsolated() throws Exception {
        JsonNode user = register("Scoped Goal Snapshot User", "scoped-goal-snapshot-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        UUID userId = UUID.fromString(user.get("userId").asText());
        String dietId = createCompetitiveDiet(user, "Scoped Goal Snapshot Diet");
        UUID dietUuid = UUID.fromString(dietId);
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));

        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/diets/{dietId}/water/checks", dietId).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isOk());

        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk());
        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today).orElseThrow().getGoalMl())
                .isEqualTo(2450);
        assertThat(waterDailyGoals.findByUserIdAndDietIdAndGoalDate(userId, dietUuid, today).orElseThrow().getGoalMl())
                .isEqualTo(2000);

        mvc.perform(put("/api/diets/{dietId}/water/goal", dietId).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":3000}"))
                .andExpect(status().isOk());
        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today).orElseThrow().getGoalMl())
                .isEqualTo(2450);
        assertThat(waterDailyGoals.findByUserIdAndDietIdAndGoalDate(userId, dietUuid, today).orElseThrow().getGoalMl())
                .isEqualTo(3000);
        assertThat(waterDailyGoals.findByUserIdAndGoalDateAndDietIsNull(userId, today)).isPresent();
        assertThat(waterDailyGoals.findByUserIdAndDietIdAndGoalDate(userId, dietUuid, today)).isPresent();
    }

    @Test
    void monthlyWaterHistoryCombinesSnapshotsChecksAndLegacyDays() throws Exception {
        JsonNode user = register("Monthly Water History User", "monthly-water-history-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);
        UUID userId = UUID.fromString(user.get("userId").asText());
        var savedUser = users.findById(userId).orElseThrow();
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        LocalDate yesterday = today.minusDays(1);
        LocalDate twoDaysAgo = today.minusDays(2);

        waterDailyGoals.saveAndFlush(new WaterDailyGoal(savedUser, null, twoDaysAgo, 2300));
        waterChecks.saveAndFlush(new WaterCheck(savedUser, 500, yesterday));
        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2450}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/water/checks").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amountMl\":500}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/water/history").header("Authorization", authorization)
                        .param("month", YearMonth.from(today).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days.length()").value(3))
                .andExpect(jsonPath("$.days[0].date").value(twoDaysAgo.toString()))
                .andExpect(jsonPath("$.days[0].consumedMl").value(0))
                .andExpect(jsonPath("$.days[0].goalMl").value(2300))
                .andExpect(jsonPath("$.days[0].percentage").value(nullValue()))
                .andExpect(jsonPath("$.days[0].hasRecords").value(false))
                .andExpect(jsonPath("$.days[1].date").value(yesterday.toString()))
                .andExpect(jsonPath("$.days[1].consumedMl").value(500))
                .andExpect(jsonPath("$.days[1].goalMl").value(nullValue()))
                .andExpect(jsonPath("$.days[1].percentage").value(nullValue()))
                .andExpect(jsonPath("$.days[1].hasRecords").value(true))
                .andExpect(jsonPath("$.days[2].date").value(today.toString()))
                .andExpect(jsonPath("$.days[2].goalMl").value(2450))
                .andExpect(jsonPath("$.days[2].percentage").value(20))
                .andExpect(jsonPath("$.days[2].hasRecords").value(true));
    }

    @Test
    void monthlyWaterHistoryValidatesMonthAndAuthentication() throws Exception {
        JsonNode user = register("Invalid Water Month User", "invalid-water-month-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);

        mvc.perform(get("/api/water/history").param("month", "2026-10"))
                .andExpect(status().isUnauthorized());
        for (String month : new String[]{"2026-13", "2026-2", "invalid"}) {
            mvc.perform(get("/api/water/history").header("Authorization", authorization).param("month", month))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/water/history").header("Authorization", authorization).param("month", "2026-11"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-11"))
                .andExpect(jsonPath("$.days").isEmpty());
    }

    @Test
    void competitiveMonthlyWaterHistoryIsScopedAndReadableAfterDietEnds() throws Exception {
        JsonNode owner = register("Monthly Competitive History Owner", "monthly-comp-history-" + UUID.randomUUID() + "@example.com");
        JsonNode outsider = register("Monthly Competitive History Outsider", "monthly-comp-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Ended History Diet", "2026-09-01", "2026-09-30");
        String authorization = bearer(owner);
        UUID userId = UUID.fromString(owner.get("userId").asText());
        var savedUser = users.findById(userId).orElseThrow();
        var savedDiet = diets.findById(UUID.fromString(dietId)).orElseThrow();
        LocalDate historyDate = LocalDate.of(2026, 9, 20);
        waterChecks.saveAndFlush(new WaterCheck(savedUser, 1000, historyDate));
        waterChecks.saveAndFlush(new WaterCheck(savedUser, savedDiet, 500, historyDate));
        waterDailyGoals.save(new WaterDailyGoal(savedUser, null, historyDate, 2200));
        waterDailyGoals.save(new WaterDailyGoal(savedUser, savedDiet, historyDate, 2000));

        mvc.perform(get("/api/water/history").header("Authorization", authorization).param("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days[0].consumedMl").value(1000))
                .andExpect(jsonPath("$.days[0].goalMl").value(2200))
                .andExpect(jsonPath("$.days[0].percentage").value(45));

        mvc.perform(get("/api/diets/{dietId}/water/history", dietId)
                        .header("Authorization", authorization).param("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days.length()").value(1))
                .andExpect(jsonPath("$.days[0].date").value("2026-09-20"))
                .andExpect(jsonPath("$.days[0].consumedMl").value(500))
                .andExpect(jsonPath("$.days[0].goalMl").value(2000))
                .andExpect(jsonPath("$.days[0].percentage").value(25));

        mvc.perform(get("/api/diets/{dietId}/water/history", dietId)
                        .header("Authorization", bearer(outsider)).param("month", "2026-09"))
                .andExpect(status().isNotFound());

        String regularDietId = createDiet(owner, "Non-Competitive History Diet");
        mvc.perform(get("/api/diets/{dietId}/water/history", regularDietId)
                        .header("Authorization", authorization).param("month", "2026-09"))
                .andExpect(status().isConflict());
    }

    @Test
    void waterTodayReturnsProfileSuggestionWithoutReplacingTheCurrentGoal() throws Exception {
        JsonNode user = register("Water Suggestion User", "water-suggestion-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);

        mvc.perform(put("/api/profile")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Water Suggestion User","weightKg":70.00,"heightCm":170}
                                """))
                .andExpect(status().isOk());

        mvc.perform(get("/api/water/today").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2000))
                .andExpect(jsonPath("$.suggestedGoalMl").value(2450));

        mvc.perform(put("/api/water/goal").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"goalMl\":2500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2500))
                .andExpect(jsonPath("$.suggestedGoalMl").value(2450));
    }

    @Test
    void hydrationHistoryStatusIncludesChecksFromPreviousDays() throws Exception {
        JsonNode user = register("Water History User", "water-history-" + UUID.randomUUID() + "@example.com");
        String authorization = bearer(user);

        mvc.perform(get("/api/water/has-checks").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(false));

        var savedUser = users.findById(UUID.fromString(user.get("userId").asText())).orElseThrow();
        waterChecks.save(new WaterCheck(savedUser, 500,
                LocalDate.now(ZoneId.of("America/Sao_Paulo")).minusDays(1)));

        mvc.perform(get("/api/water/has-checks").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(true));
        mvc.perform(get("/api/water/has-checks"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void competitiveWaterIsDietScopedAndSnapshotsTheGoal() throws Exception {
        JsonNode owner = register("Competitive Water Owner", "competitive-water-" + UUID.randomUUID() + "@example.com");
        JsonNode outsider = register("Competitive Water Outsider", "competitive-water-outsider-" + UUID.randomUUID() + "@example.com");
        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Competitive Water Owner","weightKg":70.00,"heightCm":170}
                                """))
                .andExpect(status().isOk());
        String dietId = createCompetitiveDiet(owner, "Competitive Water Diet");
        String authorization = bearer(owner);

        String response = mvc.perform(post("/api/diets/{dietId}/water/checks", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amountMl\":500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consumedMl").value(500))
                .andExpect(jsonPath("$.pointsEarned").value(2))
                .andExpect(jsonPath("$.suggestedGoalMl").value(2450))
                .andReturn().getResponse().getContentAsString();
        String checkId = objectMapper.readTree(response).get("checks").get(0).get("id").asText();

        RankingPointEvent event = rankingEvents.findBySourceTypeAndSourceId(
                RankingPointEvent.SourceType.WATER_CHECK, UUID.fromString(checkId)).orElseThrow();
        assertThat(event.getPoints()).isEqualTo(2);
        assertThat(event.getWaterGoalMl()).isEqualTo(2000);

        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUser.officialPoints").value(2))
                .andExpect(jsonPath("$.participants[0].officialPoints").value(2));

        mvc.perform(put("/api/diets/{dietId}/water/goal", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goalMl\":2500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2500))
                .andExpect(jsonPath("$.suggestedGoalMl").value(2450));
        assertThat(rankingEvents.findById(event.getId()).orElseThrow().getWaterGoalMl()).isEqualTo(2000);

        mvc.perform(get("/api/diets/{dietId}/water/today", dietId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
    }

    @Test
    void nonCompetitiveWaterKeepsTheLegacyFlowWithoutPointEvents() throws Exception {
        JsonNode owner = register("Legacy Water Owner", "legacy-water-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Legacy Water Diet");

        mvc.perform(post("/api/water/checks")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amountMl\":500}"))
                .andExpect(status().isOk());

        assertThat(rankingEvents.countByDietIdAndUserId(UUID.fromString(dietId),
                UUID.fromString(owner.get("userId").asText()))).isZero();
    }

    @Test
    void competitiveWaterRejectsWritesAfterDietEnd() throws Exception {
        JsonNode owner = register("Ended Water Owner", "ended-water-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Ended Water Diet", "2026-09-01", "2026-09-23");
        String authorization = bearer(owner);

        mvc.perform(put("/api/diets/{dietId}/water/goal", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goalMl\":2000}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/diets/{dietId}/water/checks", dietId)
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amountMl\":500}"))
                .andExpect(status().isConflict());
    }

    @Test
    void corsAcceptsEachConfiguredFrontendOrigin() throws Exception {
        for (String origin : new String[]{"http://localhost:3000", "http://localhost:5173"}) {
            mvc.perform(options("/api/health")
                            .header("Origin", origin)
                            .header("Access-Control-Request-Method", "GET"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", origin));
        }
    }

    @Test
    void protectedEndpointReturnsJsonWhenAuthenticationIsMissing() throws Exception {
        mvc.perform(get("/api/profile"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Autenticação necessária"));
    }

    @Test
    void registrationHashesPasswordAndTokenAccessesProfile() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@example.com";
        JsonNode auth = register("Test User", email);
        assertThat(auth.path("birthDate").asText()).isEqualTo("1990-01-01");

        var saved = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(saved.getPasswordHash()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", saved.getPasswordHash())).isTrue();
        assertThat(saved.getBirthDate()).isEqualTo(LocalDate.of(1990, 1, 1));

        mvc.perform(get("/api/profile").header("Authorization", bearer(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.fullName").value("Test User"))
                .andExpect(jsonPath("$.sex").value("MALE"))
                .andExpect(jsonPath("$.birthDate").value("1990-01-01"))
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("NOT_REQUIRED"))
                .andExpect(jsonPath("$.waterGoalSuggestionReview.suggestedGoalMl").value(nullValue()))
                .andExpect(jsonPath("$.weightKg").doesNotExist())
                .andExpect(jsonPath("$.heightCm").doesNotExist());

        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Updated User","weightKg":72.50,"heightCm":178,"birthDate":"1988-04-12"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Updated User"))
                .andExpect(jsonPath("$.weightKg").value(72.5))
                .andExpect(jsonPath("$.heightCm").value(178))
                .andExpect(jsonPath("$.birthDate").value("1988-04-12"));

        // Older clients omit birthDate; such an update must preserve a date saved by a newer client.
        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Updated User","weightKg":72.50,"heightCm":178}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthDate").value("1988-04-12"));

        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Must Not Apply","weightKg":75.0,"heightCm":180,"birthDate":"2099-01-01"}
                                """))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/profile").header("Authorization", bearer(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Updated User"))
                .andExpect(jsonPath("$.birthDate").value("1988-04-12"));

        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Updated User","weightKg":10,"heightCm":400}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.weightKg").exists())
                .andExpect(jsonPath("$.fields.heightCm").exists());
    }

    @Test
    void registrationRequiresBirthDateAndRejectsFutureDates() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Missing Birth Date",
                                "email", "missing-birth-date-" + UUID.randomUUID() + "@example.com",
                                "password", "password123",
                                "sex", "MALE"))))
                .andExpect(status().isBadRequest());

        LocalDate tomorrow = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(1);
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(
                                "Future Birth Date",
                                "future-birth-date-" + UUID.randomUUID() + "@example.com",
                                "password123", "MALE", tomorrow))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void legacyUserWithoutBirthDateCanStillLoginAndUpdateProfile() throws Exception {
        String email = "legacy-profile-" + UUID.randomUUID() + "@example.com";
        users.saveAndFlush(new User(email, passwordEncoder.encode("password123"), "Legacy User", UserSex.MALE));

        String loginResponse = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "password123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode auth = objectMapper.readTree(loginResponse);

        mvc.perform(get("/api/profile").header("Authorization", bearer(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthDate").doesNotExist());

        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Legacy User Updated","weightKg":72.5,"heightCm":178}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Legacy User Updated"))
                .andExpect(jsonPath("$.birthDate").doesNotExist());
    }

    @Test
    void legacyBirthDateUpdateCreatesPendingGoalReviewAndKeepDecisionIsIdempotent() throws Exception {
        String email = "legacy-water-review-" + UUID.randomUUID() + "@example.com";
        users.saveAndFlush(new User(email, passwordEncoder.encode("password123"), "Legacy Review User", UserSex.MALE));
        JsonNode auth = login(email, "password123");
        String authorization = bearer(auth);

        mvc.perform(put("/api/profile")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Legacy Review User","weightKg":70.00,"heightCm":170,"birthDate":"1990-04-15"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("PENDING"))
                .andExpect(jsonPath("$.waterGoalSuggestionReview.suggestedGoalMl").value(2450));

        mvc.perform(get("/api/water/today").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2000))
                .andExpect(jsonPath("$.suggestedGoalMl").value(2450));

        mvc.perform(put("/api/profile/water-goal-suggestion")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"KEEP_CURRENT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("RESOLVED"));

        mvc.perform(put("/api/profile/water-goal-suggestion")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPLY_RECOMMENDATION\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("RESOLVED"));
        mvc.perform(get("/api/water/today").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2000));
    }

    @Test
    void legacyBirthDateReviewAppliesSuggestionOnlyAfterExplicitDecision() throws Exception {
        String email = "legacy-water-apply-" + UUID.randomUUID() + "@example.com";
        users.saveAndFlush(new User(email, passwordEncoder.encode("password123"), "Legacy Apply User", UserSex.MALE));
        JsonNode auth = login(email, "password123");
        String authorization = bearer(auth);
        String dietId = createCompetitiveDiet(auth, "Suggestion Review Diet");

        mvc.perform(put("/api/profile")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Legacy Apply User","weightKg":70.00,"heightCm":170,"birthDate":"1990-04-15"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("PENDING"));

        mvc.perform(put("/api/profile/water-goal-suggestion")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "decision", "APPLY_RECOMMENDATION", "dietId", dietId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("RESOLVED"));

        mvc.perform(get("/api/diets/{dietId}/water/today", dietId).header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2450))
                .andExpect(jsonPath("$.suggestedGoalMl").value(2450));

        mvc.perform(put("/api/profile/water-goal-suggestion")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "decision", "APPLY_RECOMMENDATION", "dietId", dietId))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/diets/{dietId}/water/today", dietId).header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalMl").value(2450));
    }

    @Test
    void legacyBirthDateWithoutAnEligibleSuggestionDoesNotCreateGoalReview() throws Exception {
        String email = "legacy-water-no-suggestion-" + UUID.randomUUID() + "@example.com";
        users.saveAndFlush(new User(email, passwordEncoder.encode("password123"), "Legacy User", UserSex.MALE));
        JsonNode auth = login(email, "password123");

        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Legacy User","weightKg":55.00,"heightCm":170,"birthDate":"1990-04-15"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.waterGoalSuggestionReview.status").value("NOT_REQUIRED"))
                .andExpect(jsonPath("$.waterGoalSuggestionReview.suggestedGoalMl").value(nullValue()));
    }

    @Test
    void refreshTokenIsHttpOnlyAndRotates() throws Exception {
        String email = "refresh-" + UUID.randomUUID() + "@example.com";
        MvcResult registration = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterRequest("Refresh User", email, "password123", "MALE",
                                        LocalDate.of(1990, 1, 1)))))
                .andExpect(status().isOk())
                .andReturn();
        var originalCookie = registration.getResponse().getCookie("dietaday_refresh");
        assertThat(originalCookie).isNotNull();
        assertThat(originalCookie.isHttpOnly()).isTrue();

        MvcResult refresh = mvc.perform(post("/api/auth/refresh")
                        .cookie(originalCookie)
                        .header("X-Requested-With", "Dietaday"))
                .andExpect(status().isOk())
                .andReturn();
        var rotatedCookie = refresh.getResponse().getCookie("dietaday_refresh");
        assertThat(rotatedCookie).isNotNull();
        assertThat(rotatedCookie.getValue()).isNotEqualTo(originalCookie.getValue());

        mvc.perform(post("/api/auth/refresh")
                        .cookie(originalCookie)
                        .header("X-Requested-With", "Dietaday"))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/auth/logout")
                        .cookie(rotatedCookie)
                        .header("X-Requested-With", "Dietaday"))
                .andExpect(status().isOk());
    }

    @Test
    void loginRejectsUnknownEmailAndWrongPasswordWithoutLeakingWhichCredentialFailed() throws Exception {
        String email = "login-" + UUID.randomUUID() + "@example.com";
        register("Login User", email);

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "wrong-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest("missing-" + UUID.randomUUID() + "@example.com", "password123"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void dietAndHistoryRejectInvertedDateRanges() throws Exception {
        JsonNode owner = register("Date Owner", "dates-" + UUID.randomUUID() + "@example.com");

        mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Invalid","startDate":"2026-10-02","endDate":"2026-10-01"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("endDate must be on or after startDate"));

        String dietId = createDiet(owner, "Date Diet");
        mvc.perform(get("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .param("from", "2026-10-02")
                        .param("to", "2026-10-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("to must be on or after from"));
    }

    @Test
    void mealCreationIsIdempotent() throws Exception {
        JsonNode owner = register("Offline Owner", "offline-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Offline Diet");
        String operationId = UUID.randomUUID().toString();
        String request = """
                {"mealType":"LUNCH","description":"Queued meal","mealDate":"2026-09-08"}
                """;

        String first = mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", operationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pointsEarned").value(0))
                .andReturn().getResponse().getContentAsString();

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", operationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(objectMapper.readTree(first).get("id").asText()));

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", operationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"DINNER","description":"Different meal","mealDate":"2026-09-08"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Idempotency key has already been used for another request"));

        String otherDietId = createDiet(owner, "Other Offline Diet");
        mvc.perform(post("/api/diets/{dietId}/meals", otherDietId)
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", operationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Idempotency key has already been used for another request"));

        mvc.perform(get("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void competitiveOfflineRetryCreatesOneMealAndOnePointEvent() throws Exception {
        JsonNode owner = register("Competitive Offline Owner", "competitive-offline-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Competitive Offline Diet");
        String operationId = UUID.randomUUID().toString();
        String request = """
                {"mealType":"Almoço","description":"Queued competitive meal","mealDate":"2026-09-24"}
                """;

        String response = mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", operationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pointsEarned").value(5))
                .andReturn().getResponse().getContentAsString();
        String mealId = objectMapper.readTree(response).get("id").asText();

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", operationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(mealId))
                .andExpect(jsonPath("$.pointsEarned").value(5));

        assertThat(rankingEvents.countByDietIdAndUserId(UUID.fromString(dietId), UUID.fromString(owner.get("userId").asText())))
                .isEqualTo(1);
    }

    @Test
    void competitiveRankingIsProtectedAndUsesOfficialShape() throws Exception {
        JsonNode owner = register("Ranking Owner", "ranking-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode outsider = register("Ranking Outsider", "ranking-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Ranking Diet");

        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", bearer(owner))
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dietId").value(dietId))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.participants.length()").value(1))
                .andExpect(jsonPath("$.participants[0].officialPoints").value(0))
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.size").value(1))
                .andExpect(jsonPath("$.page.totalElements").value(1));

        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rankingDetailsExposePendingPointsBySource() throws Exception {
        JsonNode owner = register("Ranking Details Owner", "ranking-details-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Ranking Details Diet");

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"Almoço","description":"Pending ranking meal","mealDate":"2026-09-24"}
                                """))
                        .andExpect(status().isCreated());

        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUser.officialPoints").value(5))
                .andExpect(jsonPath("$.participants[0].officialPoints").value(5))
                .andExpect(jsonPath("$.currentUser.pendingPoints").value(5));

        mvc.perform(get("/api/diets/{dietId}/ranking/me", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingPoints").value(5))
                .andExpect(jsonPath("$.mealCountByType.ALMOCO").value(1))
                .andExpect(jsonPath("$.eligibleWaterChecks").value(0))
                .andExpect(jsonPath("$.events.length()").value(1))
                .andExpect(jsonPath("$.page.totalElements").value(1));
    }

    @Test
    void rankingActivityShowsOnlyTheLatestEventFromAnotherMember() throws Exception {
        JsonNode owner = register("Activity Owner", "activity-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Activity Member", "activity-member-" + UUID.randomUUID() + "@example.com");
        JsonNode outsider = register("Activity Outsider", "activity-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Activity Diet");
        joinDiet(owner, member, dietId, member.get("email").asText());

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"Almoço","description":"Activity meal","mealDate":"2026-09-24"}
                                """))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/diets/{dietId}/ranking/activity", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").isNotEmpty())
                .andExpect(jsonPath("$.sourceType").value("MEAL"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        mvc.perform(get("/api/diets/{dietId}/ranking/activity", dietId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").value((Object) null));

        mvc.perform(get("/api/diets/{dietId}/ranking/activity", dietId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rankingRejectsOversizedPages() throws Exception {
        JsonNode owner = register("Ranking Page Owner", "ranking-page-" + UUID.randomUUID() + "@example.com");
        String dietId = createCompetitiveDiet(owner, "Ranking Page Diet");

        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", bearer(owner))
                        .param("size", "101"))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/diets/{dietId}/ranking/me", dietId)
                        .header("Authorization", bearer(owner))
                        .param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void membersCanReactOnceToMealsFromOtherUsers() throws Exception {
        String firstMemberEmail = "reaction-one-" + UUID.randomUUID() + "@example.com";
        String secondMemberEmail = "reaction-two-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Reaction Owner", "reaction-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode firstMember = register("First Member", firstMemberEmail);
        JsonNode secondMember = register("Second Member", secondMemberEmail);
        JsonNode outsider = register("Reaction Outsider", "reaction-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Reaction Diet");
        joinDiet(owner, firstMember, dietId, firstMemberEmail);
        joinDiet(owner, secondMember, dietId, secondMemberEmail);

        String mealJson = mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"LUNCH","description":"Meal to react",
                                 "mealDate":"2026-09-11"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reactions").isEmpty())
                .andReturn().getResponse().getContentAsString();
        String mealId = objectMapper.readTree(mealJson).get("id").asText();

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(firstMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"not an emoji\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid emoji"));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You cannot react to your own meal"));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(outsider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isNotFound());

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(firstMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].emoji").value("❤️"))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(true));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(firstMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"😂\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions.length()").value(1))
                .andExpect(jsonPath("$.reactions[0].emoji").value("😂"))
                .andExpect(jsonPath("$.reactions[0].count").value(1));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(secondMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"😂\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].count").value(2));

        mvc.perform(get("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reactions[0].emoji").value("😂"))
                .andExpect(jsonPath("$[0].reactions[0].count").value(2))
                .andExpect(jsonPath("$[0].reactions[0].reactedByMe").value(false));

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(firstMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(false));

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/reaction", dietId, mealId)
                        .header("Authorization", bearer(firstMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].count").value(1));
    }

    @Test
    void commentsSupportCrudValidationAuthorizationIsolationAndCounts() throws Exception {
        String memberEmail = "comment-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Comment Owner", "comment-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Comment Member", memberEmail);
        JsonNode outsider = register("Comment Outsider", "comment-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Comment Diet");
        String otherDietId = createDiet(owner, "Other Comment Diet");
        joinDiet(owner, member, dietId, memberEmail);
        String mealId = createMeal(owner, dietId, "Meal with comments");
        String otherMealId = createMeal(owner, dietId, "Other meal");

        mvc.perform(post("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.content").exists());

        mvc.perform(post("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "x".repeat(1001)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.content").exists());

        String memberCommentJson = mvc.perform(post(
                        "/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"  First comment  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mealId").value(mealId))
                .andExpect(jsonPath("$.authorId").value(member.get("userId").asText()))
                .andExpect(jsonPath("$.authorName").value("Comment Member"))
                .andExpect(jsonPath("$.content").value("First comment"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.reactions").isEmpty())
                .andReturn().getResponse().getContentAsString();
        String memberCommentId = objectMapper.readTree(memberCommentJson).get("id").asText();
        String ownerCommentId = createComment(owner, dietId, mealId, "Second comment");

        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(memberCommentId))
                .andExpect(jsonPath("$[1].id").value(ownerCommentId))
                .andExpect(jsonPath("$[2]").doesNotExist());

        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}", dietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentCount").value(2));
        mvc.perform(get("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(otherMealId))
                .andExpect(jsonPath("$[0].commentCount").value(0))
                .andExpect(jsonPath("$[1].id").value(mealId))
                .andExpect(jsonPath("$[1].commentCount").value(2));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, mealId, memberCommentId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Owner cannot edit\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, mealId, ownerCommentId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isForbidden());

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, mealId, memberCommentId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"  Edited comment  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Edited comment"));

        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(outsider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Hidden\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}/comments", otherDietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, otherMealId, memberCommentId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Crossed\"}"))
                .andExpect(status().isNotFound());

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, mealId, memberCommentId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}", dietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentCount").value(1));
    }

    @Test
    void onlyMealAuthorCanReactOnceToAnotherUsersComment() throws Exception {
        String firstEmail = "comment-reaction-one-" + UUID.randomUUID() + "@example.com";
        String secondEmail = "comment-reaction-two-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Comment Reaction Owner",
                "comment-reaction-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode firstMember = register("Comment Reaction One", firstEmail);
        JsonNode secondMember = register("Comment Reaction Two", secondEmail);
        String dietId = createDiet(owner, "Comment Reaction Diet");
        joinDiet(owner, firstMember, dietId, firstEmail);
        joinDiet(owner, secondMember, dietId, secondEmail);
        String mealId = createMeal(owner, dietId, "Reaction target meal");
        String commentId = createComment(firstMember, dietId, mealId, "React to this");
        String ownCommentId = createComment(owner, dietId, mealId, "Owner comment");

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(firstMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the meal author can react to comments"));
        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(secondMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, ownCommentId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You cannot react to your own comment"));
        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"invalid\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"❤️\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].emoji").value("❤️"))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(true));
        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"😂\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions.length()").value(1))
                .andExpect(jsonPath("$.reactions[0].emoji").value("😂"));

        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reactions[0].reactedByMe").value(true));
        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(firstMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reactions[0].reactedByMe").value(false));

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions").isEmpty());
        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}/reaction",
                        dietId, mealId, commentId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions").isEmpty());
    }

    @Test
    void commentNotificationsAreRecipientScopedReadableAndRemovedWithComment() throws Exception {
        String firstEmail = "notification-one-" + UUID.randomUUID() + "@example.com";
        String secondEmail = "notification-two-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Notification Owner",
                "notification-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode firstMember = register("Notification One", firstEmail);
        JsonNode secondMember = register("Notification Two", secondEmail);
        String dietId = createDiet(owner, "Notification Diet");
        joinDiet(owner, firstMember, dietId, firstEmail);
        joinDiet(owner, secondMember, dietId, secondEmail);
        String mealId = createMeal(owner, dietId, "Notification meal");
        String firstCommentId = createComment(firstMember, dietId, mealId, "First notification");
        createComment(owner, dietId, mealId, "Self comment");
        String secondCommentId = createComment(secondMember, dietId, mealId, "Second notification");

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2));
        String notificationsJson = mvc.perform(get("/api/notifications")
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("MEAL_COMMENTED"))
                .andExpect(jsonPath("$[0].dietId").value(dietId))
                .andExpect(jsonPath("$[0].mealId").value(mealId))
                .andExpect(jsonPath("$[0].mealDate").value("2026-09-04"))
                .andExpect(jsonPath("$[0].commentId").value(secondCommentId))
                .andExpect(jsonPath("$[0].actorId").value(secondMember.get("userId").asText()))
                .andExpect(jsonPath("$[0].actorName").value("Notification Two"))
                .andExpect(jsonPath("$[0].mealType").value("LUNCH"))
                .andExpect(jsonPath("$[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$[0].readAt").doesNotExist())
                .andExpect(jsonPath("$[1].commentId").value(firstCommentId))
                .andExpect(jsonPath("$[2]").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String latestNotificationId = objectMapper.readTree(notificationsJson).get(0).get("id").asText();

        mvc.perform(get("/api/notifications").header("Authorization", bearer(firstMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(put("/api/notifications/{id}/read", latestNotificationId)
                        .header("Authorization", bearer(firstMember)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2));

        mvc.perform(put("/api/notifications/{id}/read", latestNotificationId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(put("/api/notifications/{id}/read", latestNotificationId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, mealId, firstCommentId)
                        .header("Authorization", bearer(firstMember))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Edited without notification\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/notifications").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mvc.perform(put("/api/notifications/read-all").header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
        mvc.perform(get("/api/notifications").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readAt").isNotEmpty())
                .andExpect(jsonPath("$[1].readAt").isNotEmpty());

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}/comments/{commentId}",
                        dietId, mealId, secondCommentId)
                        .header("Authorization", bearer(secondMember)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].commentId").value(firstCommentId));
    }

    @Test
    void mealNudgesSupportEveryOfficialMealAndAppearInTheUnifiedNotificationFeed() throws Exception {
        String ownerEmail = "nudge-owner-" + UUID.randomUUID() + "@example.com";
        String recipientEmail = "nudge-recipient-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Nudge Owner", ownerEmail);
        JsonNode recipient = register("Nudge Recipient", recipientEmail);
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        String dietId = mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Noncompetitive nudge diet",
                                "startDate", today.minusDays(2).toString(),
                                "endDate", today.plusDays(30).toString(),
                                "competitiveMode", false))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.competitiveMode").value(false))
                .andReturn().getResponse().getContentAsString();
        dietId = objectMapper.readTree(dietId).get("id").asText();
        joinDiet(owner, recipient, dietId, recipientEmail);

        mvc.perform(get("/api/diets/{dietId}/meal-nudges/eligibility", dietId)
                        .param("recipientId", recipient.get("userId").asText())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.length()").value(6))
                .andExpect(jsonPath("$.meals[0].eligible").value(true));

        String[] mealTypes = {"BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER", "SUPPER"};
        String[] messages = {
                "O café da manhã foi tomar café sozinho? Cadê o registro? ☕😂",
                "E esse lanchinho da manhã, tá em missão secreta? 🍎🕵️",
                "Tá comendo escondido aí? 😂",
                "A tarde chegou e o lanche sumiu! Cadê as provas? 🥪👀",
                "E o jantar, foi abduzido ou você esqueceu de postar? 🛸🍽️",
                "A fiscalização noturna passou: cadê a ceia? 🌙😂",
        };
        for (int index = 0; index < mealTypes.length; index++) {
            String request = objectMapper.writeValueAsString(Map.of(
                    "recipientId", recipient.get("userId").asText(), "mealType", mealTypes[index]));
            mvc.perform(post("/api/diets/{dietId}/meal-nudges", dietId)
                            .header("Authorization", bearer(owner))
                            .contentType(MediaType.APPLICATION_JSON).content(request))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.mealType").value(mealTypes[index]))
                    .andExpect(jsonPath("$.message").value(messages[index]))
                    .andExpect(jsonPath("$.mealDate").value(today.toString()));
            mvc.perform(post("/api/diets/{dietId}/meal-nudges", dietId)
                            .header("Authorization", bearer(owner))
                            .contentType(MediaType.APPLICATION_JSON).content(request))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(6));
        mvc.perform(get("/api/notifications").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].type").value("MEAL_NUDGED"))
                .andExpect(jsonPath("$[0].actorName").value("Nudge Owner"))
                .andExpect(jsonPath("$[0].message").isNotEmpty())
                .andExpect(jsonPath("$[0].mealId").doesNotExist())
                .andExpect(jsonPath("$[0].readAt").doesNotExist());

        String firstNudgeId = mvc.perform(get("/api/notifications").header("Authorization", bearer(recipient)))
                .andReturn().getResponse().getContentAsString();
        firstNudgeId = objectMapper.readTree(firstNudgeId).get(0).get("id").asText();
        mvc.perform(put("/api/notifications/{id}/read", firstNudgeId)
                        .header("Authorization", bearer(recipient)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(5));
        mvc.perform(put("/api/notifications/read-all").header("Authorization", bearer(recipient)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void mealNudgeEligibilityRechecksMealsPreferencesMembershipAndSelfTargeting() throws Exception {
        String ownerEmail = "nudge-rules-owner-" + UUID.randomUUID() + "@example.com";
        String recipientEmail = "nudge-rules-recipient-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Nudge Rules Owner", ownerEmail);
        JsonNode recipient = register("Nudge Rules Recipient", recipientEmail);
        JsonNode outsider = register("Nudge Rules Outsider", "nudge-outsider-" + UUID.randomUUID() + "@example.com");
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        String dietId = mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Nudge Rules Diet",
                                "startDate", today.minusDays(1).toString(), "endDate", today.plusDays(2).toString()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        dietId = objectMapper.readTree(dietId).get("id").asText();
        joinDiet(owner, recipient, dietId, recipientEmail);

        mvc.perform(get("/api/diets/{dietId}/meal-nudges/eligibility", dietId)
                        .param("recipientId", owner.get("userId").asText())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals[0].eligible").value(false))
                .andExpect(jsonPath("$.meals[0].reason").value("SELF"));
        mvc.perform(post("/api/diets/{dietId}/meal-nudges", dietId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("recipientId", owner.get("userId").asText(), "mealType", "LUNCH"))))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(recipient)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("mealType", "Almoço", "description", "Already registered", "mealDate", today.toString()))))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/diets/{dietId}/meal-nudges/eligibility", dietId)
                        .param("recipientId", recipient.get("userId").asText())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals[2].eligible").value(false))
                .andExpect(jsonPath("$.meals[2].reason").value("ALREADY_REGISTERED"));
        mvc.perform(post("/api/diets/{dietId}/meal-nudges", dietId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("recipientId", recipient.get("userId").asText(), "mealType", "LUNCH"))))
                .andExpect(status().isConflict());

        mvc.perform(put("/api/profile/meal-nudges").header("Authorization", bearer(recipient))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receiveMealNudges").value(false));
        mvc.perform(post("/api/diets/{dietId}/meal-nudges", dietId)
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("recipientId", recipient.get("userId").asText(), "mealType", "DINNER"))))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/diets/{dietId}/meal-nudges/eligibility/all", dietId)
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/diets/{dietId}/meal-nudges/eligibility", dietId)
                        .param("recipientId", outsider.get("userId").asText())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void simultaneousMealNudgesPersistOnlyOneForTheSameDailyKey() throws Exception {
        String ownerEmail = "nudge-race-owner-" + UUID.randomUUID() + "@example.com";
        String recipientEmail = "nudge-race-recipient-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Nudge Race Owner", ownerEmail);
        JsonNode recipient = register("Nudge Race Recipient", recipientEmail);
        LocalDate today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        String dietJson = mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Nudge Race Diet",
                                "startDate", today.minusDays(1).toString(), "endDate", today.plusDays(2).toString()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String dietId = objectMapper.readTree(dietJson).get("id").asText();
        joinDiet(owner, recipient, dietId, recipientEmail);
        String request = objectMapper.writeValueAsString(Map.of(
                "recipientId", recipient.get("userId").asText(), "mealType", "LUNCH"));
        String authorization = bearer(owner);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var sendNudge = (java.util.concurrent.Callable<Integer>) () -> {
                ready.countDown();
                if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test did not start");
                return mvc.perform(post("/api/diets/{dietId}/meal-nudges", dietId)
                                .header("Authorization", authorization)
                                .contentType(MediaType.APPLICATION_JSON).content(request))
                        .andReturn().getResponse().getStatus();
            };
            Future<Integer> first = executor.submit(sendNudge);
            Future<Integer> second = executor.submit(sendNudge);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            int firstStatus = first.get(10, TimeUnit.SECONDS);
            int secondStatus = second.get(10, TimeUnit.SECONDS);
            assertThat(List.of(firstStatus, secondStatus)).contains(201);
            assertThat(List.of(firstStatus, secondStatus)).allMatch(status -> status == 201 || status == 200 || status == 409);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
        mvc.perform(get("/api/notifications").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void commentNotificationsAreHiddenAfterMealAuthorLeavesDiet() throws Exception {
        String authorEmail = "former-author-" + UUID.randomUUID() + "@example.com";
        String commenterEmail = "remaining-commenter-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Diet Owner", "notification-diet-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode author = register("Former Meal Author", authorEmail);
        JsonNode commenter = register("Remaining Commenter", commenterEmail);
        String dietId = createDiet(owner, "Membership Notification Diet");
        joinDiet(owner, author, dietId, authorEmail);
        joinDiet(owner, commenter, dietId, commenterEmail);
        String mealId = createMeal(author, dietId, "Meal from former member");

        createComment(commenter, dietId, mealId, "Visible before leaving");
        String notificationJson = mvc.perform(get("/api/notifications")
                        .header("Authorization", bearer(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        String notificationId = objectMapper.readTree(notificationJson).get(0).get("id").asText();

        leaveDiet(author, dietId, null).andExpect(status().isNoContent());
        createComment(commenter, dietId, mealId, "Created after author left");

        mvc.perform(get("/api/notifications").header("Authorization", bearer(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
        mvc.perform(put("/api/notifications/{id}/read", notificationId)
                        .header("Authorization", bearer(author)))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberCannotChangeDietOwnedByAnotherUser() throws Exception {
        String memberEmail = "restricted-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Restricted Owner", "restricted-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Restricted Member", memberEmail);
        String dietId = createDiet(owner, "Owner Diet");

        String invitationId = invite(owner, dietId, memberEmail);
        mvc.perform(post("/api/invitations/{id}/accept", invitationId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());

        mvc.perform(put("/api/diets/{id}", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Member Change","startDate":"2026-09-01","endDate":"2026-10-01"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the diet owner can perform this action"));

        mvc.perform(delete("/api/diets/{id}", dietId).header("Authorization", bearer(member)))
                .andExpect(status().isForbidden());
    }

    @Test
    void mealIdCannotBeUsedThroughAnotherDiet() throws Exception {
        JsonNode owner = register("Isolation Owner", "isolation-" + UUID.randomUUID() + "@example.com");
        String firstDietId = createDiet(owner, "First Diet");
        String secondDietId = createDiet(owner, "Second Diet");

        String mealJson = mvc.perform(post("/api/diets/{id}/meals", firstDietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"LUNCH","description":"First diet meal","mealDate":"2026-09-04"}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String mealId = objectMapper.readTree(mealJson).get("id").asText();

        mvc.perform(get("/api/diets/{dietId}/meals/{mealId}", secondDietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}", secondDietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void pendingInvitationDoesNotGrantAccessAndAcceptanceCreatesMembership() throws Exception {
        String ownerEmail = "owner-" + UUID.randomUUID() + "@example.com";
        String memberEmail = "member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Owner", ownerEmail);
        JsonNode member = register("Member", memberEmail);

        String dietJson = mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Cutting","startDate":"2026-09-01","endDate":"2026-10-01"}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String dietId = objectMapper.readTree(dietJson).get("id").asText();

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(member)))
                .andExpect(status().isNotFound());

        String invitationJson = mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.dietId").value(dietId))
                .andExpect(jsonPath("$.dietName").value("Cutting"))
                .andExpect(jsonPath("$.inviterId").value(owner.get("userId").asText()))
                .andExpect(jsonPath("$.inviterName").value("Owner"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        String invitationId = objectMapper.readTree(invitationJson).get("id").asText();

        mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A pending invitation already exists for this user"));

        mvc.perform(get("/api/invitations").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mvc.perform(get("/api/invitations").header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(invitationId))
                .andExpect(jsonPath("$[0].dietId").value(dietId))
                .andExpect(jsonPath("$[1]").doesNotExist());

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(member)))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/invitations/{id}/accept", invitationId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/invitations/{id}/accept", invitationId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Invitation has already been answered"));

        mvc.perform(get("/api/invitations").header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cutting"));

        String mealJson = mvc.perform(post("/api/diets/{id}/meals", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"LUNCH","description":"Rice and chicken",
                                 "mealDate":"2026-09-04","photoUrl":"https://res.cloudinary.com/test-cloud/image/upload/v1/meal.jpg"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photoUrl").value("https://res.cloudinary.com/test-cloud/image/upload/v1/meal.jpg"))
                .andExpect(jsonPath("$.authorId").value(member.get("userId").asText()))
                .andExpect(jsonPath("$.authorName").value("Member"))
                .andReturn().getResponse().getContentAsString();
        String mealId = objectMapper.readTree(mealJson).get("id").asText();

        mvc.perform(get("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].authorId").value(member.get("userId").asText()))
                .andExpect(jsonPath("$[0].authorName").value("Member"));

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}", dietId, mealId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"DINNER","description":"Unauthorized change",
                                 "mealDate":"2026-09-04"}
                                """))
                .andExpect(status().isForbidden());

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}", dietId, mealId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isForbidden());

        mvc.perform(put("/api/diets/{dietId}/meals/{mealId}", dietId, mealId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"DINNER","description":"Author change",
                                 "mealDate":"2026-09-04"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Author change"));

        mvc.perform(delete("/api/diets/{dietId}/meals/{mealId}", dietId, mealId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());
    }

    @Test
    void onlyInviteeCanAnswerAndDeclineIsFinal() throws Exception {
        String inviteeEmail = "decline-invitee-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Decline Owner", "decline-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode invitee = register("Decline Invitee", inviteeEmail);
        JsonNode other = register("Other User", "other-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Declined Diet");
        String invitationId = invite(owner, dietId, inviteeEmail);

        mvc.perform(post("/api/invitations/{id}/decline", invitationId)
                        .header("Authorization", bearer(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the invited user can answer this invitation"));

        mvc.perform(post("/api/invitations/{id}/accept", invitationId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/invitations/{id}/decline", invitationId)
                        .header("Authorization", bearer(invitee)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/invitations/{id}/decline", invitationId)
                        .header("Authorization", bearer(invitee)))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/invitations").header("Authorization", bearer(invitee)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(invitee)))
                .andExpect(status().isNotFound());
    }

    @Test
    void onlyOwnerCanInviteAndSelfOrExistingMemberCannotBeInvited() throws Exception {
        String memberEmail = "rules-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Rules Owner", "rules-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Rules Member", memberEmail);
        JsonNode outsider = register("Rules Outsider", "rules-outsider-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Rules Diet");

        mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(owner.get("email").asText()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You cannot invite yourself"));

        String invitationId = invite(owner, dietId, memberEmail);
        mvc.perform(post("/api/invitations/{id}/accept", invitationId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already a member"));

        mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(outsider.get("email").asText()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the diet owner can invite users"));

        mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(outsider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberLeavesWithoutDeletingMealHistoryOrAuthorship() throws Exception {
        String memberEmail = "leaving-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Leave Owner", "leave-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Leaving Member", memberEmail);
        String dietId = createDiet(owner, "Leave Diet");
        joinDiet(owner, member, dietId, memberEmail);

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"LUNCH","description":"Meal before leaving",
                                 "mealDate":"2026-09-04"}
                                """))
                .andExpect(status().isCreated());

        leaveDiet(member, dietId, null).andExpect(status().isNoContent());

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(member)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/diets/{dietId}/meals", dietId).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("Meal before leaving"))
                .andExpect(jsonPath("$[0].authorId").value(member.get("userId").asText()))
                .andExpect(jsonPath("$[0].authorName").value("Leaving Member"));
    }

    @Test
    void competitiveMemberLeavesWhilePreservingAndRevokingPendingEvents() throws Exception {
        String memberEmail = "competitive-leaving-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Competitive Leave Owner", "competitive-leave-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Competitive Leaving Member", memberEmail);
        String dietId = createCompetitiveDiet(owner, "Competitive Leave Diet");
        joinDiet(owner, member, dietId, memberEmail);

        mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"Almoço","description":"Competitive meal before leaving","mealDate":"2026-09-24"}
                                """))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/diets/{dietId}/water/checks", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amountMl\":500}"))
                .andExpect(status().isOk());

        leaveDiet(member, dietId, null).andExpect(status().isNoContent());

        assertThat(rankingEvents.findAllByDietIdAndUserIdAndStatusOrderByEventDateAscCreatedAtAsc(
                UUID.fromString(dietId), UUID.fromString(member.get("userId").asText()), RankingPointEvent.Status.REVOKED))
                .hasSize(2);
        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(get("/api/diets/{dietId}/ranking", dietId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNotFound());
    }

    @Test
    void ownerTransfersOwnershipAndLeaves() throws Exception {
        String successorEmail = "successor-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Transfer Owner", "transfer-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode successor = register("Successor", successorEmail);
        String dietId = createDiet(owner, "Transfer Diet");
        joinDiet(owner, successor, dietId, successorEmail);

        leaveDiet(owner, dietId, UUID.fromString(successor.get("userId").asText()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/diets/{id}/members", dietId).header("Authorization", bearer(successor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value(successor.get("userId").asText()))
                .andExpect(jsonPath("$[0].role").value("OWNER"))
                .andExpect(jsonPath("$[1]").doesNotExist());
    }

    @Test
    void soleOwnerCannotLeave() throws Exception {
        JsonNode owner = register("Sole Owner", "sole-owner-" + UUID.randomUUID() + "@example.com");
        String dietId = createDiet(owner, "Sole Diet");

        leaveDiet(owner, dietId, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("The only owner cannot leave the diet"));

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(owner)))
                .andExpect(status().isOk());
    }

    @Test
    void ownerCannotTransferToSelfInvalidUserOrMemberOfAnotherDiet() throws Exception {
        String memberEmail = "valid-successor-" + UUID.randomUUID() + "@example.com";
        String outsiderEmail = "other-diet-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Invalid Successor Owner", "invalid-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Valid Successor", memberEmail);
        JsonNode outsider = register("Other Diet Member", outsiderEmail);
        String dietId = createDiet(owner, "Successor Rules");
        String otherDietId = createDiet(outsider, "Other Diet");
        joinDiet(owner, member, dietId, memberEmail);

        leaveDiet(owner, dietId, UUID.fromString(owner.get("userId").asText()))
                .andExpect(status().isBadRequest());
        leaveDiet(owner, dietId, UUID.randomUUID())
                .andExpect(status().isBadRequest());
        leaveDiet(owner, dietId, UUID.fromString(outsider.get("userId").asText()))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(owner)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/diets/{id}", otherDietId).header("Authorization", bearer(outsider)))
                .andExpect(status().isOk());
    }

    private JsonNode register(String name, String email) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                         .content(objectMapper.writeValueAsString(new RegisterRequest(name, email, "password123", "MALE",
                                 LocalDate.of(1990, 1, 1)))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response);
    }

    private JsonNode login(String email, String password) throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response);
    }

    private String createDiet(JsonNode auth, String name) throws Exception {
        String response = mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new DietRequest(name, "2026-09-01", "2026-10-01"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

    private String createCompetitiveDiet(JsonNode auth, String name) throws Exception {
        String endDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(30).toString();
        return createCompetitiveDiet(auth, name, "2026-09-01", endDate);
    }

    private String createCompetitiveDiet(JsonNode auth, String name, String startDate, String endDate) throws Exception {
        String response = mvc.perform(post("/api/diets")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"%s","startDate":"%s","endDate":"%s","competitiveMode":true}
                                """.formatted(name, startDate, endDate)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

    private String createMeal(JsonNode auth, String dietId, String description) throws Exception {
        String response = mvc.perform(post("/api/diets/{dietId}/meals", dietId)
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "mealType", "LUNCH", "description", description, "mealDate", "2026-09-04"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

    private String createComment(JsonNode auth, String dietId, String mealId, String content) throws Exception {
        String response = mvc.perform(post("/api/diets/{dietId}/meals/{mealId}/comments", dietId, mealId)
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", content))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

    private String invite(JsonNode owner, String dietId, String email) throws Exception {
        String response = mvc.perform(post("/api/diets/{id}/invitations", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(email))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

    private void joinDiet(JsonNode owner, JsonNode member, String dietId, String memberEmail) throws Exception {
        String invitationId = invite(owner, dietId, memberEmail);
        mvc.perform(post("/api/invitations/{id}/accept", invitationId)
                        .header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());
    }

    private org.springframework.test.web.servlet.ResultActions leaveDiet(
            JsonNode user, String dietId, UUID successorId) throws Exception {
        return mvc.perform(post("/api/diets/{id}/leave", dietId)
                .header("Authorization", bearer(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LeaveRequest(successorId))));
    }

    private String bearer(JsonNode auth) {
        return "Bearer " + auth.get("token").asText();
    }

    private record RegisterRequest(String fullName, String email, String password, String sex, LocalDate birthDate) {}
    private record LoginRequest(String email, String password) {}
    private record DietRequest(String name, String startDate, String endDate) {}
    private record EmailRequest(String email) {}
    private record LeaveRequest(UUID successorId) {}
}
