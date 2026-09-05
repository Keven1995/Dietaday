package com.dietapp.security;

import com.dietapp.common.NotFoundException;
import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUser {
    private final UserRepository users;

    public CurrentUser(UserRepository users) {
        this.users = users;
    }

    public UUID id() {
        return UUID.fromString(SecurityContextHolder.getContext().getAuthentication().getName());
    }

    public User require() {
        return users.findById(id()).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
