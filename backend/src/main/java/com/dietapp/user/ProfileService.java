package com.dietapp.user;

import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;

    public ProfileService(CurrentUser currentUser, SecurityAuditService audit) {
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get() {
        return ProfileResponse.from(currentUser.require());
    }

    @Transactional
    public ProfileResponse update(UpdateProfileRequest request) {
        User user = currentUser.require();
        user.updateProfile(request.fullName().trim(), request.weightKg(), request.heightCm(), request.sex());
        audit.profileUpdated(user.getId());
        return ProfileResponse.from(user);
    }
}
