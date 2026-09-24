package com.dietapp.diet;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
public class DietService {
    private final DietRepository diets;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;

    public DietService(DietRepository diets, DietMemberRepository members, CurrentUser currentUser,
                       SecurityAuditService audit) {
        this.diets = diets;
        this.members = members;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional
    public Diet create(String name, LocalDate startDate, LocalDate endDate, boolean competitiveMode) {
        validateDates(startDate, endDate);
        var owner = currentUser.require();
        Diet diet = diets.save(new Diet(name.trim(), startDate, endDate, competitiveMode));
        members.save(new DietMember(diet, owner, DietMember.Role.OWNER));
        audit.dietCreated(owner.getId(), diet.getId());
        return diet;
    }

    @Transactional(readOnly = true)
    public Page<Diet> list(Pageable pageable) {
        return diets.findAllForUser(currentUser.id(), pageable);
    }

    @Transactional(readOnly = true)
    public Diet requireMember(UUID dietId) {
        return requireMembership(dietId).getDiet();
    }

    @Transactional
    public Diet requireMemberForUpdate(UUID dietId) {
        Diet diet = diets.findForUpdateById(dietId)
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        requireMembership(dietId);
        return diet;
    }

    @Transactional
    public Diet update(UUID dietId, String name, LocalDate startDate, LocalDate endDate, boolean competitiveMode) {
        validateDates(startDate, endDate);
        Diet diet = requireOwner(dietId);
        if (diet.isCompetitiveMode() != competitiveMode) {
            throw new ConflictException("Competitive mode cannot be changed after diet creation");
        }
        diet.update(name.trim(), startDate, endDate);
        return diet;
    }

    @Transactional
    public void delete(UUID dietId) {
        Diet diet = requireOwner(dietId);
        diets.deleteById(dietId);
        audit.dietDeleted(currentUser.id(), diet.getId());
    }

    @Transactional(readOnly = true)
    public Page<DietMember> listMembers(UUID dietId, Pageable pageable) {
        requireMember(dietId);
        return members.findAllByDietId(dietId, pageable);
    }

    @Transactional
    public void leave(UUID dietId, UUID successorId) {
        diets.findForUpdateById(dietId)
                .orElseThrow(() -> new NotFoundException("Diet not found"));

        DietMember membership = members.findByDietIdAndUserId(dietId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        if (membership.getRole() == DietMember.Role.MEMBER) {
            if (successorId != null) {
                throw new BadRequestException("A member cannot appoint a successor");
            }
            members.delete(membership);
            audit.memberLeft(membership.getUser().getId(), dietId);
            return;
        }

        if (members.countByDietId(dietId) == 1) {
            throw new ConflictException("The only owner cannot leave the diet");
        }
        if (successorId == null) {
            throw new BadRequestException("successorId is required for the owner to leave");
        }
        if (successorId.equals(currentUser.id())) {
            throw new BadRequestException("The owner cannot appoint themselves as successor");
        }

        DietMember successor = members.findByDietIdAndUserId(dietId, successorId)
                .filter(member -> member.getRole() == DietMember.Role.MEMBER)
                .orElseThrow(() -> new BadRequestException("Successor must be a current member of the diet"));
        successor.promoteToOwner();
        members.delete(membership);
        audit.memberOwnershipTransferred(membership.getUser().getId(), dietId, successorId);
    }

    private Diet requireOwner(UUID dietId) {
        DietMember membership = requireMembership(dietId);
        if (membership.getRole() != DietMember.Role.OWNER) {
            throw new ForbiddenException("Only the diet owner can perform this action");
        }
        return membership.getDiet();
    }

    private DietMember requireMembership(UUID dietId) {
        return members.findByDietIdAndUserId(dietId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Diet not found"));
    }

    private void validateDates(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new BadRequestException("endDate must be on or after startDate");
        }
    }
}
