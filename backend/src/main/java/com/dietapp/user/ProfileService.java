package com.dietapp.user;

import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final CurrentUser currentUser;

    public ProfileService(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get() {
        return ProfileResponse.from(currentUser.require());
    }

    @Transactional
    public ProfileResponse update(UpdateProfileRequest request) {
        User user = currentUser.require();
        user.updateProfile(request.fullName().trim(), request.weightKg(), request.heightCm());
        return ProfileResponse.from(user);
    }
}
