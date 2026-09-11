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

    private record RegisterRequest(String fullName, String email, String password) {}
    private record LoginRequest(String email, String password) {}
    private record DietRequest(String name, String startDate, String endDate) {}
    private record EmailRequest(String email) {}
    private record LeaveRequest(UUID successorId) {}
}
