package com.dietapp.diet;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateDietMealTypesRequest(@NotEmpty @Size(max = 6) List<String> mealTypes) {}
