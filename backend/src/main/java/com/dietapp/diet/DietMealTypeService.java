package com.dietapp.diet;

import com.dietapp.common.BadRequestException;
import com.dietapp.common.ForbiddenException;
import com.dietapp.common.NotFoundException;
import com.dietapp.ranking.CompetitiveMealType;
import com.dietapp.security.CurrentUser;
import com.dietapp.security.SecurityAuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DietMealTypeService {
    public static final List<String> DEFAULT_MEAL_TYPES = java.util.Arrays.stream(CompetitiveMealType.values())
            .map(CompetitiveMealType::label)
            .toList();
    private static final ZoneId DIET_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final Set<String> OFFICIAL_MEAL_TYPES = Set.copyOf(DEFAULT_MEAL_TYPES);

    private final DietMealTypeSettingRepository settings;
    private final DietRepository diets;
    private final DietMemberRepository members;
    private final CurrentUser currentUser;
    private final SecurityAuditService audit;
    private final Clock clock;

    public DietMealTypeService(DietMealTypeSettingRepository settings, DietRepository diets,
                               DietMemberRepository members, CurrentUser currentUser,
                               SecurityAuditService audit, Clock clock) {
        this.settings = settings;
        this.diets = diets;
        this.members = members;
        this.currentUser = currentUser;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public void initialize(Diet diet, UUID ownerId, List<String> requestedMealTypes) {
        List<String> mealTypes = normalize(requestedMealTypes, true);
        saveConfiguration(diet.getId(), diet.getStartDate(), ownerId, mealTypes);
    }

    @Transactional(readOnly = true)
    public List<DietMealTypeScheduleEntry> scheduleForMember(UUID dietId) {
        if (!members.existsByDietIdAndUserId(dietId, currentUser.id())) {
            throw new NotFoundException("Diet not found");
        }
        Diet diet = diets.findById(dietId).orElseThrow(() -> new NotFoundException("Diet not found"));
        return scheduleForDiet(diet);
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<DietMealTypeScheduleEntry>> schedulesForDiets(Collection<Diet> dietList) {
        if (dietList.isEmpty()) return Map.of();
        Map<UUID, Diet> dietsById = dietList.stream().collect(Collectors.toMap(Diet::getId, diet -> diet));
        Map<UUID, Map<LocalDate, List<String>>> grouped = new LinkedHashMap<>();
        settings.findAllByDietIdInOrderByDietIdAscEffectiveFromAscMealTypeAsc(dietsById.keySet())
                .forEach(setting -> grouped
                        .computeIfAbsent(setting.getDietId(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(setting.getEffectiveFrom(), ignored -> new ArrayList<>())
                        .add(setting.getMealType()));
        Map<UUID, List<DietMealTypeScheduleEntry>> result = new LinkedHashMap<>();
        dietsById.forEach((dietId, diet) -> result.put(dietId,
                toSchedule(grouped.getOrDefault(dietId, Map.of()), diet.getStartDate())));
        return result;
    }

    @Transactional
    public List<DietMealTypeScheduleEntry> update(UUID dietId, List<String> requestedMealTypes) {
        List<String> mealTypes = normalize(requestedMealTypes, false);
        var actor = currentUser.require();
        Diet diet = diets.findForUpdateById(dietId)
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        DietMember membership = members.findByDietIdAndUserId(dietId, actor.getId())
                .orElseThrow(() -> new NotFoundException("Diet not found"));
        if (membership.getRole() != DietMember.Role.OWNER) {
            throw new ForbiddenException("Only the current diet owner can edit meal types");
        }

        LocalDate today = LocalDate.now(clock.withZone(DIET_ZONE));
        LocalDate effectiveFrom = today.isBefore(diet.getStartDate()) ? diet.getStartDate() : today.plusDays(1);
        List<DietMealTypeScheduleEntry> currentSchedule = scheduleForDiet(diet);
        List<DietMealTypeSetting> existingFutureSettings = settings
                .findAllByDietIdAndEffectiveFromGreaterThanEqual(dietId, effectiveFrom);
        Map<LocalDate, List<String>> futureSchedule = group(existingFutureSettings);
        List<String> pendingTypes = futureSchedule.get(effectiveFrom);
        List<String> currentTypes = mealTypesForDate(currentSchedule, today);
        if (futureSchedule.isEmpty() && currentTypes.equals(mealTypes)) return currentSchedule;
        if (pendingTypes != null && sameTypes(pendingTypes, mealTypes) && futureSchedule.size() == 1) {
            return currentSchedule;
        }

        settings.deleteAll(existingFutureSettings);
        settings.flush();
        saveConfiguration(dietId, effectiveFrom, actor.getId(), mealTypes);
        audit.dietMealTypesUpdated(actor.getId(), dietId, effectiveFrom, mealTypes.size());
        return scheduleForDiet(diet);
    }

    @Transactional(readOnly = true)
    public List<String> mealTypesForDate(UUID dietId, LocalDate date) {
        Diet diet = diets.findById(dietId).orElseThrow(() -> new NotFoundException("Diet not found"));
        return mealTypesForDate(scheduleForDiet(diet), date);
    }

    @Transactional(readOnly = true)
    public void requireMealTypeConfigured(UUID dietId, LocalDate date, String mealType) {
        if (!mealTypesForDate(dietId, date).contains(canonicalMealTypeLabel(mealType))) {
            throw new BadRequestException("Este tipo de refeição não está configurado para a dieta nesta data.");
        }
    }

    public static String canonicalMealTypeLabel(String mealType) {
        if (mealType == null || OFFICIAL_MEAL_TYPES.contains(mealType)) return mealType;
        try {
            return CompetitiveMealType.valueOf(mealType).label();
        } catch (IllegalArgumentException exception) {
            return mealType;
        }
    }

    public static List<String> mealTypesForDate(List<DietMealTypeScheduleEntry> schedule, LocalDate date) {
        if (schedule == null || schedule.isEmpty()) return DEFAULT_MEAL_TYPES;
        return schedule.stream()
                .filter(entry -> !entry.effectiveFrom().isAfter(date))
                .max(Comparator.comparing(DietMealTypeScheduleEntry::effectiveFrom))
                .or(() -> schedule.stream().min(Comparator.comparing(DietMealTypeScheduleEntry::effectiveFrom)))
                .map(DietMealTypeScheduleEntry::mealTypes)
                .orElse(DEFAULT_MEAL_TYPES);
    }

    public static List<String> normalize(List<String> requestedMealTypes, boolean defaultWhenMissing) {
        if (requestedMealTypes == null) {
            if (defaultWhenMissing) return DEFAULT_MEAL_TYPES;
            throw new BadRequestException("Selecione pelo menos um tipo de refeição.");
        }
        if (requestedMealTypes.isEmpty()) throw new BadRequestException("Selecione pelo menos um tipo de refeição.");
        Set<String> selected = new LinkedHashSet<>(requestedMealTypes);
        if (selected.size() != requestedMealTypes.size()) {
            throw new BadRequestException("Não repita os tipos de refeição selecionados.");
        }
        if (!OFFICIAL_MEAL_TYPES.containsAll(selected)) {
            throw new BadRequestException("A lista contém um tipo de refeição não suportado.");
        }
        return DEFAULT_MEAL_TYPES.stream().filter(selected::contains).toList();
    }

    private List<DietMealTypeScheduleEntry> scheduleForDiet(Diet diet) {
        return toSchedule(group(settings.findAllByDietIdOrderByEffectiveFromAscMealTypeAsc(diet.getId())),
                diet.getStartDate());
    }

    private Map<LocalDate, List<String>> group(List<DietMealTypeSetting> rows) {
        Map<LocalDate, List<String>> grouped = new LinkedHashMap<>();
        rows.forEach(setting -> grouped.computeIfAbsent(setting.getEffectiveFrom(), ignored -> new ArrayList<>())
                .add(setting.getMealType()));
        return grouped;
    }

    private List<DietMealTypeScheduleEntry> toSchedule(Map<LocalDate, List<String>> grouped, LocalDate fallbackDate) {
        if (grouped.isEmpty()) return List.of(new DietMealTypeScheduleEntry(fallbackDate, DEFAULT_MEAL_TYPES));
        return grouped.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new DietMealTypeScheduleEntry(entry.getKey(), normalize(entry.getValue(), true)))
                .toList();
    }

    private void saveConfiguration(UUID dietId, LocalDate effectiveFrom, UUID updatedBy, List<String> mealTypes) {
        var now = clock.instant();
        settings.saveAll(mealTypes.stream()
                .map(mealType -> new DietMealTypeSetting(dietId, effectiveFrom, mealType, now, updatedBy))
                .toList());
        settings.flush();
    }

    private boolean sameTypes(List<String> left, List<String> right) {
        return normalize(left, false).equals(right);
    }
}
