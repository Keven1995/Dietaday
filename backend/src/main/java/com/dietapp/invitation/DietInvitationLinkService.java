package com.dietapp.invitation;

import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.DietMember;
import com.dietapp.diet.DietMemberRepository;
import com.dietapp.diet.DietRepository;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class DietInvitationLinkService {
    private static final Duration LINK_TTL = Duration.ofDays(30);
    private static final Pattern TOKEN_FORMAT = Pattern.compile("[A-Za-z0-9_-]{43}");

    private final DietInvitationLinkRepository links;
    private final InvitationRepository invitations;
    private final DietMemberRepository members;
    private final DietRepository diets;
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;
    private final byte[] tokenSigningKey;

    public DietInvitationLinkService(DietInvitationLinkRepository links, InvitationRepository invitations,
                                     DietMemberRepository members, DietRepository diets,
                                     CurrentUser currentUser, SecurityAuditService audit,
                                     @Value("${app.jwt.secret}") String tokenSigningKey) {
        this.links = links;
        this.invitations = invitations;
        this.members = members;
        this.diets = diets;
        this.currentUser = currentUser;
        this.audit = audit;
        this.tokenSigningKey = tokenSigningKey.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public CreatedDietInvitationLink create(UUID dietId, UUID operationId) {
        var actor = currentUser.require();
        diets.findForUpdateById(dietId)
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        var ownerMembership = requireOwnerMembership(dietId, actor.getId());
        Instant now = Instant.now();
        String token = generateToken(actor.getId(), dietId, operationId);
        String tokenHash = hashToken(token);
        DietInvitationLink previousOperation = links.findByTokenHash(tokenHash).orElse(null);
        if (previousOperation != null) {
            if (!previousOperation.getCreator().getId().equals(actor.getId())
                    || !previousOperation.getDiet().getId().equals(dietId)
                    || previousOperation.getRevokedAt() != null || previousOperation.isExpired(now)) {
                throw new ConflictException("This idempotency key has already created an inactive invitation link");
            }
            return new CreatedDietInvitationLink(token, previousOperation.getExpiresAt());
        }

        links.findAllByDietIdAndRevokedAtIsNull(dietId).forEach(link -> link.revoke(now));
        links.flush();

        Instant expiresAt = now.plus(LINK_TTL);
        try {
            links.saveAndFlush(new DietInvitationLink(
                    ownerMembership.getDiet(), actor, tokenHash, now, expiresAt));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("An invitation link was created concurrently. Please try again", exception);
        }
        audit.memberInvitationLinkCreated(actor.getId(), dietId);
        return new CreatedDietInvitationLink(token, expiresAt);
    }

    @Transactional
    public void revoke(UUID dietId) {
        var actor = currentUser.require();
        diets.findForUpdateById(dietId)
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        requireOwnerMembership(dietId, actor.getId());
        Instant now = Instant.now();
        var activeLinks = links.findAllByDietIdAndRevokedAtIsNull(dietId);
        activeLinks.forEach(link -> link.revoke(now));
        if (!activeLinks.isEmpty()) {
            links.flush();
            audit.memberInvitationLinkRevoked(actor.getId(), dietId);
        }
    }

    @Transactional(readOnly = true)
    public DietInvitationLinkPreview preview(String token) {
        DietInvitationLink link = links.findByTokenHashAndRevokedAtIsNull(hashToken(token))
                .orElseThrow(this::invalidLink);
        if (link.isExpired(Instant.now())) throw invalidLink();
        return DietInvitationLinkPreview.from(link);
    }

    @Transactional
    public UUID accept(String token) {
        DietInvitationLink observed = links.findByTokenHashAndRevokedAtIsNull(hashToken(token))
                .orElseThrow(this::invalidLink);
        UUID dietId = observed.getDiet().getId();
        diets.findForUpdateById(dietId).orElseThrow(this::invalidLink);
        DietInvitationLink link = links.findForUpdateByTokenHashAndRevokedAtIsNull(hashToken(token))
                .orElseThrow(this::invalidLink);
        Instant now = Instant.now();
        if (link.isExpired(now)) throw invalidLink();

        var user = currentUser.require();
        dietId = link.getDiet().getId();
        if (members.existsByDietIdAndUserId(dietId, user.getId())) {
            throw new ConflictException("You are already a member of this diet");
        }
        try {
            members.saveAndFlush(new DietMember(link.getDiet(), user, DietMember.Role.MEMBER));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("You are already a member of this diet", exception);
        }
        invitations.findFirstForUpdateByDietIdAndInviteeIdAndStatus(dietId, user.getId(), Invitation.Status.PENDING)
                .ifPresent(invitation -> {
                    invitation.accept();
                    invitations.saveAndFlush(invitation);
                });
        audit.memberInvitationAccepted(user.getId(), dietId);
        return dietId;
    }

    private DietMember requireOwnerMembership(UUID dietId, UUID userId) {
        DietMember membership = members.findByDietIdAndUserId(dietId, userId)
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        if (membership.getRole() != DietMember.Role.OWNER) {
            throw new ForbiddenException("Only the diet owner can manage invitation links");
        }
        return membership;
    }

    private String generateToken(UUID creatorId, UUID dietId, UUID operationId) {
        String message = "diet-invitation-link:v1:" + creatorId + ":" + dietId + ":" + operationId;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(tokenSigningKey, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not derive invitation link token", exception);
        }
    }

    private String hashToken(String token) {
        if (token == null || !TOKEN_FORMAT.matcher(token).matches()) throw invalidLink();
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private NotFoundException invalidLink() {
        return new NotFoundException("Invitation link is invalid, expired, or revoked");
    }
}
