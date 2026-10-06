package com.dietapp.meal;

import com.dietapp.comment.MealCommentRepository;
import com.dietapp.diet.DietService;
import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class MealSocialDiscoveryService {
    private final DietService diets;
    private final MealCommentRepository comments;
    private final MealReactionRepository reactions;
    private final CurrentUser currentUser;

    public MealSocialDiscoveryService(DietService diets, MealCommentRepository comments,
                                      MealReactionRepository reactions, CurrentUser currentUser) {
        this.diets = diets;
        this.comments = comments;
        this.reactions = reactions;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public boolean hasInteractedWithAnotherMemberMeal(UUID dietId) {
        diets.requireMember(dietId);
        UUID userId = currentUser.id();
        return comments.existsByUserCommentedOnAnotherMemberMeal(dietId, userId)
                || reactions.existsByUserReactedToAnotherMemberMeal(dietId, userId);
    }
}
