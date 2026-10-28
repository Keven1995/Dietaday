package com.dietapp.telemetry;

import com.dietapp.common.ForbiddenException;
import com.dietapp.diet.DietRepository;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncErrorEventService {
    private final SyncErrorEventRepository errors;
    private final DietRepository diets;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;
    private final UserRepository users;

    public SyncErrorEventService(SyncErrorEventRepository errors, DietRepository diets,
                                 DietMemberRepository members, CurrentUser currentUser, UserRepository users) {
        this.errors = errors;
        this.diets = diets;
        this.members = members;
        this.currentUser = currentUser;
        this.users = users;
    }

    @Transactional
    public void record(SyncTelemetryRequest request) {
        if (request.errorType() == null) return;
        if (!members.existsByDietIdAndUserId(request.dietId(), currentUser.id())) {
            throw new ForbiddenException("The user is not a member of this diet");
        }
        users.findForUpdateById(currentUser.id()).orElseThrow();
        if (errors.existsByOperationIdAndPhaseAndAttempt(request.operationId(), request.phase(), request.attempt())) {
            return;
        }
        errors.save(new SyncErrorEvent(request.operationId(), currentUser.require(),
                diets.getReferenceById(request.dietId()), request));
    }
}
