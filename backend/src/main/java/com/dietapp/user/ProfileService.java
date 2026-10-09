package com.dietapp.user;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import com.dietapp.water.WaterGoalSuggestionService;
import com.dietapp.water.WaterTrackingService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;

@Service
public class ProfileService {
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;
    private final Clock clock;
    private final UserRepository users;
    private final WaterGoalSuggestionService goalSuggestions;
    private final WaterTrackingService waterTracking;

    public ProfileService(CurrentUser currentUser, SecurityAuditService audit, Clock clock,
                          UserRepository users, WaterGoalSuggestionService goalSuggestions,
                          WaterTrackingService waterTracking) {
        this.currentUser = currentUser;
        this.audit = audit;
        this.clock = clock;
        this.users = users;
        this.goalSuggestions = goalSuggestions;
        this.waterTracking = waterTracking;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get() {
        return responseFor(currentUser.require());
    }

    @Transactional
    public ProfileResponse update(UpdateProfileRequest request) {
        User user = currentUser.require();
        boolean addingFirstBirthDate = user.getBirthDate() == null && request.birthDate() != null;
        if (request.birthDate() != null && request.birthDate().isAfter(LocalDate.now(clock))) {
            throw new BadRequestException("A data de nascimento não pode ser no futuro.");
        }
        user.updateProfile(request.fullName().trim(), request.weightKg(), request.heightCm(),
                request.sex(), request.birthDate());
        if (addingFirstBirthDate
                && user.getWaterGoalSuggestionReviewStatus() == WaterGoalSuggestionReviewStatus.NOT_REQUIRED
                && goalSuggestions.suggestedGoalMl(user) != null) {
            user.markWaterGoalSuggestionReviewPending();
        }
        audit.profileUpdated(user.getId());
        return responseFor(user);
    }

    @Transactional
    public ProfileResponse decideWaterGoalSuggestion(WaterGoalSuggestionDecisionRequest request) {
        User user = users.findForUpdateById(currentUser.id()).orElseThrow();
        if (user.getWaterGoalSuggestionReviewStatus() != WaterGoalSuggestionReviewStatus.PENDING) {
            return responseFor(user);
        }

        if (request.decision() == WaterGoalSuggestionDecisionRequest.Decision.APPLY_RECOMMENDATION) {
            Integer suggestedGoalMl = goalSuggestions.suggestedGoalMl(user);
            if (suggestedGoalMl == null) {
                throw new ConflictException("A sugestão de meta não está mais disponível.");
            }
            if (request.dietId() == null) waterTracking.updateGoal(suggestedGoalMl);
            else waterTracking.updateCompetitiveGoal(request.dietId(), suggestedGoalMl);
        }

        user.resolveWaterGoalSuggestionReview();
        audit.profileUpdated(user.getId());
        return responseFor(user);
    }

    @Transactional
    public ProfileResponse updateMealNudgePreference(MealNudgePreferenceRequest request) {
        User user = currentUser.require();
        user.setReceiveMealNudges(request.enabled());
        audit.profileUpdated(user.getId());
        return responseFor(user);
    }

    private ProfileResponse responseFor(User user) {
        Integer suggestedGoalMl = user.getWaterGoalSuggestionReviewStatus() == WaterGoalSuggestionReviewStatus.PENDING
                ? goalSuggestions.suggestedGoalMl(user)
                : null;
        return ProfileResponse.from(user,
                new WaterGoalSuggestionReviewResponse(user.getWaterGoalSuggestionReviewStatus(), suggestedGoalMl));
    }
}
