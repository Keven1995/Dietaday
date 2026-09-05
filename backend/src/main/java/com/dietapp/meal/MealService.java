package com.dietapp.meal;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.diet.Diet;
import com.dietapp.diet.DietService;
import com.dietapp.security.CurrentUser;
import com.dietapp.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class MealService {
    private final MealRepository meals;
    private final DietService diets;
    private final CurrentUser currentUser;

    public MealService(MealRepository meals, DietService diets, CurrentUser currentUser) {
        this.meals = meals;
        this.diets = diets;
        this.currentUser = currentUser;
    }

    @Transactional
    public Meal create(UUID dietId, String mealType, String description, LocalDate mealDate, String photoUrl) {
        Diet diet = diets.requireMember(dietId);
        User author = currentUser.require();
        return meals.save(new Meal(diet, author, mealType, description, mealDate, photoUrl));
    }

    @Transactional(readOnly = true)
    public List<Meal> list(UUID dietId, LocalDate fromDate, LocalDate toDate) {
        diets.requireMember(dietId);
        if (fromDate != null && toDate != null && toDate.isBefore(fromDate)) {
            throw new BadRequestException("to must be on or after from");
        }
        return meals.findHistory(dietId, fromDate, toDate);
    }

    @Transactional(readOnly = true)
    public Meal get(UUID dietId, UUID mealId) {
        diets.requireMember(dietId);
        return meals.findByIdAndDietId(mealId, dietId).orElseThrow(() -> new NotFoundException("Meal not found"));
    }

    @Transactional
    public Meal update(UUID dietId, UUID mealId, String mealType, String description,
                       LocalDate mealDate, String photoUrl) {
        Meal meal = get(dietId, mealId);
        requireAuthor(meal);
        meal.update(mealType, description, mealDate, photoUrl);
        return meal;
    }

    @Transactional
    public void delete(UUID dietId, UUID mealId) {
        Meal meal = get(dietId, mealId);
        requireAuthor(meal);
        meals.delete(meal);
    }

    private void requireAuthor(Meal meal) {
        if (!meal.getAuthor().getId().equals(currentUser.id())) {
            throw new ForbiddenException("Only the meal author can perform this action");
        }
    }
}
