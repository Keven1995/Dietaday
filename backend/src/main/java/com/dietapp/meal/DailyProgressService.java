package com.dietapp.meal;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietService;
import com.dietapp.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
public class DailyProgressService {
    private static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");
    private final MealRepository meals;
    private final DietService diets;
    private final CurrentUser currentUser;

    public DailyProgressService(MealRepository meals, DietService diets, CurrentUser currentUser) {
        this.meals = meals;
        this.diets = diets;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public DailyProgressResponse today(java.util.UUID dietId) {
        Diet diet = diets.requireMember(dietId);
        LocalDate today = LocalDate.now(BRASILIA);
        if (today.isBefore(diet.getStartDate())) {
            return empty(dietId, today);
        }

        LocalDate referenceDate = today.isAfter(diet.getEndDate()) ? diet.getEndDate() : today;
        Map<LocalDate, Set<String>> mealsByDate = new LinkedHashMap<>();
        meals.findDailyMealEntries(dietId, currentUser.id(), diet.getStartDate(), referenceDate)
                .forEach(entry -> DailyMealGoal.addMeal(mealsByDate, entry.getMealDate(), entry.getMealType()));
        DailyMealGoal.Result result = DailyMealGoal.calculate(referenceDate, diet.getStartDate(), mealsByDate);
        return new DailyProgressResponse(dietId, referenceDate, DailyMealGoal.TARGET, result.completedMeals(),
                result.completedMealTypes(), result.completed(), result.streakDays());
    }

    private DailyProgressResponse empty(java.util.UUID dietId, LocalDate date) {
        return new DailyProgressResponse(dietId, date, DailyMealGoal.TARGET, 0, java.util.List.of(), false, 0);
    }
}
