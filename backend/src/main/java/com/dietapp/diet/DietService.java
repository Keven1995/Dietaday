package com.dietapp.diet;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ConflictException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import com.dietapp.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class DietService {
    private final DietRepository diets;
    private final DietMemberRepository members;
    private final UserRepository users;
    private final CurrentUser currentUser;

    public DietService(DietRepository diets, DietMemberRepository members,
                       UserRepository users, CurrentUser currentUser) {
        this.diets = diets;
        this.members = members;
        this.users = users;
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

    @Transactional
    public DietMember invite(UUID dietId, String email) {
        Diet diet = requireOwner(dietId);
        User user = users.findByEmailIgnoreCase(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new NotFoundException("No registered user has this email"));
        if (members.existsByDietIdAndUserId(dietId, user.getId())) {
            throw new ConflictException("User is already a member");
        }
        try {
            return members.saveAndFlush(new DietMember(diet, user, DietMember.Role.MEMBER));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("User is already a member", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<DietMember> listMembers(UUID dietId) {
        requireMember(dietId);
        return members.findAllByDietId(dietId);
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
