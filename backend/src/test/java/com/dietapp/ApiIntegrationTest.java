package com.dietapp;

import com.dietapp.user.UserRepository;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void healthEndpointIsPublic() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
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

        var saved = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(saved.getPasswordHash()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", saved.getPasswordHash())).isTrue();

        mvc.perform(get("/api/profile").header("Authorization", bearer(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.fullName").value("Test User"))
                .andExpect(jsonPath("$.weightKg").doesNotExist())
                .andExpect(jsonPath("$.heightCm").doesNotExist());

        mvc.perform(put("/api/profile")
                        .header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Updated User","weightKg":72.50,"heightCm":178}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Updated User"))
                .andExpect(jsonPath("$.weightKg").value(72.5))
                .andExpect(jsonPath("$.heightCm").value(178));

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
    void memberCannotChangeDietOwnedByAnotherUser() throws Exception {
        String memberEmail = "restricted-member-" + UUID.randomUUID() + "@example.com";
        JsonNode owner = register("Restricted Owner", "restricted-owner-" + UUID.randomUUID() + "@example.com");
        JsonNode member = register("Restricted Member", memberEmail);
        String dietId = createDiet(owner, "Owner Diet");

        mvc.perform(post("/api/diets/{id}/members/invite", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isCreated());

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
    void onlyMembersCanAccessDietAndOwnerCanInviteRegisteredUser() throws Exception {
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

        mvc.perform(post("/api/diets/{id}/members/invite", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("MEMBER"));

        mvc.perform(post("/api/diets/{id}/members/invite", dietId)
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmailRequest(memberEmail))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already a member"));

        mvc.perform(get("/api/diets/{id}", dietId).header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cutting"));

        String mealJson = mvc.perform(post("/api/diets/{id}/meals", dietId)
                        .header("Authorization", bearer(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mealType":"LUNCH","description":"Rice and chicken",
                                 "mealDate":"2026-09-04","photoUrl":"https://example.com/meal.jpg"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photoUrl").value("https://example.com/meal.jpg"))
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

    private JsonNode register(String name, String email) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(name, email, "password123"))))
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

    private String bearer(JsonNode auth) {
        return "Bearer " + auth.get("token").asText();
    }

    private record RegisterRequest(String fullName, String email, String password) {}
    private record LoginRequest(String email, String password) {}
    private record DietRequest(String name, String startDate, String endDate) {}
    private record EmailRequest(String email) {}
}
