package com.dietapp.diet;

import com.dietapp.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "diet_members")
public class DietMember {
    public enum Role { OWNER, MEMBER }

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    protected DietMember() {}

    public DietMember(Diet diet, User user, Role role) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.user = user;
        this.role = role;
        this.joinedAt = Instant.now();
    }

    public Diet getDiet() { return diet; }
    public User getUser() { return user; }
    public Role getRole() { return role; }
}
