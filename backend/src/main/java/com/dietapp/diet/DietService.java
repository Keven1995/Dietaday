package com.dietapp.diet;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class DietService {
    private final DietRepository diets;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;

    public DietService(DietRepository diets, DietMemberRepository members, CurrentUser currentUser) {
        this.diets = diets;
        this.members = members;
        this.currentUser = currentUser;
    }

    @Transactional
    public Diet create(String name, LocalDate startDate, LocalDate endDate) {
        validateDates(startDate, endDate);
        Diet diet = diets.save(new Diet(name.trim(), startDate, endDate));
        members.save(new DietMember(diet, currentUser.require(), DietMember.Role.OWNER));
        return diet;
    }

    @Transactional(readOnly = true)
    public List<Diet> list() {
        return diets.findAllForUser(currentUser.id());
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
    public Diet update(UUID dietId, String name, LocalDate startDate, LocalDate endDate) {
        validateDates(startDate, endDate);
        Diet diet = requireOwner(dietId);
        diet.update(name.trim(), startDate, endDate);
        return diet;
    }

    @Transactional
    public void delete(UUID dietId) {
        requireOwner(dietId);
        diets.deleteById(dietId);
    }

    @Transactional(readOnly = true)
    public List<DietMember> listMembers(UUID dietId) {
        requireMember(dietId);
        return members.findAllByDietId(dietId);
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
            return;
        }

        List<DietMember> currentMembers = members.findAllByDietId(dietId);
        if (currentMembers.size() == 1) {
            throw new ConflictException("The only owner cannot leave the diet");
        }
        if (successorId == null) {
            throw new BadRequestException("successorId is required for the owner to leave");
        }
        if (successorId.equals(currentUser.id())) {
            throw new BadRequestException("The owner cannot appoint themselves as successor");
        }

        DietMember successor = currentMembers.stream()
                .filter(member -> member.getUser().getId().equals(successorId))
                .filter(member -> member.getRole() == DietMember.Role.MEMBER)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Successor must be a current member of the diet"));
        successor.promoteToOwner();
        members.delete(membership);
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
