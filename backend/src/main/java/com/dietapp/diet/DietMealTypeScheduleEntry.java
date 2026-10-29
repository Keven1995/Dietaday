package com.dietapp.diet;

import java.time.LocalDate;
import java.util.List;

public record DietMealTypeScheduleEntry(LocalDate effectiveFrom, List<String> mealTypes) {}
