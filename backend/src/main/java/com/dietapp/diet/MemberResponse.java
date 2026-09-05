package com.dietapp.diet;

import java.util.UUID;

public record MemberResponse(UUID userId, String email, String fullName, DietMember.Role role) {
    static MemberResponse from(DietMember member) {
        return new MemberResponse(member.getUser().getId(), member.getUser().getEmail(),
                member.getUser().getFullName(), member.getRole());
    }
}
