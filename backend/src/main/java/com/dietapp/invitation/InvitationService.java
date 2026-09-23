package com.dietapp.invitation;

import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class InvitationService {
    private final InvitationRepository invitations;
    private final DietMemberRepository members;
    private final UserRepository users;
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;

    public InvitationService(InvitationRepository invitations, DietMemberRepository members,
                             UserRepository users, CurrentUser currentUser, SecurityAuditService audit) {
        this.invitations = invitations;
        this.members = members;
        this.users = users;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional
    public Invitation create(UUID dietId, String email) {
        User inviter = currentUser.require();
        DietMember ownerMembership = members.findByDietIdAndUserId(dietId, inviter.getId())
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        if (ownerMembership.getRole() != DietMember.Role.OWNER) {
            throw new ForbiddenException("Only the diet owner can invite users");
        }

        User invitee = users.findByEmailIgnoreCase(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new NotFoundException("No registered user has this email"));
        if (invitee.getId().equals(inviter.getId())) {
            throw new ConflictException("You cannot invite yourself");
        }
        if (members.existsByDietIdAndUserId(dietId, invitee.getId())) {
            throw new ConflictException("User is already a member");
        }

        Diet diet = ownerMembership.getDiet();
        try {
            Invitation invitation = invitations.saveAndFlush(new Invitation(diet, inviter, invitee));
            audit.memberInvitationCreated(inviter.getId(), dietId, invitee.getId());
            return invitation;
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("A pending invitation already exists for this user", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<Invitation> listPending() {
        return invitations.findAllByInviteeIdAndStatusOrderByCreatedAtDesc(
                currentUser.id(), Invitation.Status.PENDING);
    }

    @Transactional
    public void accept(UUID invitationId) {
        Invitation invitation = requirePendingForCurrentUser(invitationId);
        try {
            members.saveAndFlush(new DietMember(
                    invitation.getDiet(), invitation.getInvitee(), DietMember.Role.MEMBER));
            invitation.accept();
            invitations.saveAndFlush(invitation);
            audit.memberInvitationAccepted(currentUser.id(), invitation.getDiet().getId());
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("User is already a member", exception);
        }
    }

    @Transactional
    public void decline(UUID invitationId) {
        Invitation invitation = requirePendingForCurrentUser(invitationId);
        invitation.decline();
        invitations.saveAndFlush(invitation);
        audit.memberInvitationDeclined(currentUser.id(), invitation.getDiet().getId());
    }

    private Invitation requirePendingForCurrentUser(UUID invitationId) {
        Invitation invitation = invitations.findForUpdateById(invitationId)
                .orElseThrow(() -> new NotFoundException("Invitation not found"));
        if (!invitation.getInvitee().getId().equals(currentUser.id())) {
            throw new ForbiddenException("Only the invited user can answer this invitation");
        }
        if (invitation.getStatus() != Invitation.Status.PENDING) {
            throw new ConflictException("Invitation has already been answered");
        }
        return invitation;
    }
}
