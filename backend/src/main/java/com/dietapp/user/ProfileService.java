package com.dietapp.user;

import com.dietapp.common.BadRequestException;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;

@Service
public class ProfileService {
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;
    private final Clock clock;

    public ProfileService(CurrentUser currentUser, SecurityAuditService audit, Clock clock) {
        this.currentUser = currentUser;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get() {
        return ProfileResponse.from(currentUser.require());
    }

    @Transactional
    public ProfileResponse update(UpdateProfileRequest request) {
        User user = currentUser.require();
        if (request.birthDate() != null && request.birthDate().isAfter(LocalDate.now(clock))) {
            throw new BadRequestException("A data de nascimento não pode ser no futuro.");
        }
        user.updateProfile(request.fullName().trim(), request.weightKg(), request.heightCm(),
                request.sex(), request.birthDate());
        audit.profileUpdated(user.getId());
        return ProfileResponse.from(user);
    }
}
