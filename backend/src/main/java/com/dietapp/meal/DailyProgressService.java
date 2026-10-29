package com.dietapp.meal;

import com.dietapp.diet.Diet;
import com.dietapp.diet.DietMealTypeScheduleEntry;
import com.dietapp.diet.DietMealTypeService;
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
    private final DietMealTypeService dietMealTypes;

    public DailyProgressService(MealRepository meals, DietService diets, CurrentUser currentUser,
                                DietMealTypeService dietMealTypes) {
        this.meals = meals;
        this.diets = diets;
        this.currentUser = currentUser;
        this.dietMealTypes = dietMealTypes;
    }

    @Transactional(readOnly = true)
    public DailyProgressResponse today(java.util.UUID dietId) {
        Diet diet = diets.requireMember(dietId);
        LocalDate today = LocalDate.now(BRASILIA);
        var mealTypeSchedule = dietMealTypes.schedulesForDiets(java.util.List.of(diet))
                .getOrDefault(dietId, java.util.List.of(new DietMealTypeScheduleEntry(
                        diet.getStartDate(), DietMealTypeService.DEFAULT_MEAL_TYPES)));
        if (today.isBefore(diet.getStartDate())) {
            return empty(dietId, today, mealTypeSchedule);
        }

        LocalDate referenceDate = today.isAfter(diet.getEndDate()) ? diet.getEndDate() : today;
        Map<LocalDate, Set<String>> mealsByDate = new LinkedHashMap<>();
        meals.findDailyMealEntries(dietId, currentUser.id(), diet.getStartDate(), referenceDate)
                .forEach(entry -> DailyMealGoal.addMeal(mealsByDate, entry.getMealDate(), entry.getMealType()));
        DailyMealGoal.Result result = DailyMealGoal.calculate(referenceDate, diet.getStartDate(), mealsByDate,
                mealTypeSchedule);
        return new DailyProgressResponse(dietId, referenceDate, result.mealTypes().size(), result.completedMeals(),
                result.completedMealTypes(), result.completed(), result.streakDays(), result.mealTypes());
    }

    private DailyProgressResponse empty(java.util.UUID dietId, LocalDate date,
                                        java.util.List<DietMealTypeScheduleEntry> mealTypeSchedule) {
        java.util.List<String> mealTypes = DietMealTypeService.mealTypesForDate(mealTypeSchedule, date);
        return new DailyProgressResponse(dietId, date, mealTypes.size(), 0,
                java.util.List.of(), false, 0, mealTypes);
    }
}
