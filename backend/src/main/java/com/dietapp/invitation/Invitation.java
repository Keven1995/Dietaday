package com.dietapp.invitation;

import com.dietapp.diet.Diet;
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
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "diet_invitations")
public class Invitation {
    public enum Status { PENDING, ACCEPTED, DECLINED }

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "diet_id", nullable = false)
    private Diet diet;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inviter_id", nullable = false)
    private User inviter;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invitee_id", nullable = false)
    private User invitee;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "responded_at")
    private Instant respondedAt;
    @Column(name = "pending_marker")
    private Boolean pendingMarker;
    @Version
    @Column(nullable = false)
    private long version;

    protected Invitation() {}

    public Invitation(Diet diet, User inviter, User invitee) {
        this.id = UUID.randomUUID();
        this.diet = diet;
        this.inviter = inviter;
        this.invitee = invitee;
        this.status = Status.PENDING;
        this.createdAt = Instant.now();
        this.pendingMarker = true;
    }

    public UUID getId() { return id; }
    public Diet getDiet() { return diet; }
    public User getInviter() { return inviter; }
    public User getInvitee() { return invitee; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getRespondedAt() { return respondedAt; }

    public void accept() {
        respond(Status.ACCEPTED);
    }

    public void decline() {
        respond(Status.DECLINED);
    }

    private void respond(Status response) {
        if (status != Status.PENDING) {
            throw new IllegalStateException("Invitation has already been answered");
        }
        status = response;
        respondedAt = Instant.now();
        pendingMarker = null;
    }
}
