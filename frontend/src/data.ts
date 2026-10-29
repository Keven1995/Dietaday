import type { Diet, Invitation, Meal, Member } from './types'
import { DIET_MEAL_TYPES, type DietMealTypeScheduleEntry } from './lib/dietMealTypes'

export const initialDiets: Diet[] = [
  { id: '1', name: 'Equilíbrio diário', startDate: '2026-09-01', endDate: '2026-09-30', competitiveMode: false,
    canManageMealTypes: true, mealTypeSchedule: [{ effectiveFrom: '2026-09-01', mealTypes: [...DIET_MEAL_TYPES] }] },
  { id: '2', name: 'Mais energia', startDate: '2026-10-01', endDate: '2026-10-21', competitiveMode: false,
    canManageMealTypes: true, mealTypeSchedule: [{ effectiveFrom: '2026-10-01', mealTypes: [...DIET_MEAL_TYPES] }] },
]

const invitedDemoDiet: Diet = { id: '3', name: 'Hábitos em família', startDate: '2026-09-05', endDate: '2026-10-05', competitiveMode: false }
let demoInvitationResponse: 'accepted' | 'declined' | null = null
const leftDemoDietIds = new Set<string>()
const demoMealTypeSchedules = new Map<string, DietMealTypeScheduleEntry[]>()

export const initialInvitations: Invitation[] = [
  { id: 'demo-invitation-1', dietId: invitedDemoDiet.id, dietName: invitedDemoDiet.name, inviterId: '2', inviterName: 'Rafael Lima', createdAt: '2026-09-05T09:00:00Z' },
]

export function getDemoDiets() {
  const diets = demoInvitationResponse === 'accepted' ? [...initialDiets, invitedDemoDiet] : initialDiets
  return diets.filter((diet) => !leftDemoDietIds.has(diet.id)).map((diet) => ({
    ...diet,
    canManageMealTypes: diet.id !== invitedDemoDiet.id,
    mealTypeSchedule: demoMealTypeSchedules.get(diet.id) ?? diet.mealTypeSchedule,
  }))
}

export function setDemoDietMealTypeSchedule(dietId: string, schedule: DietMealTypeScheduleEntry[]) {
  demoMealTypeSchedules.set(dietId, schedule)
}

export function leaveDemoDiet(dietId: string) {
  leftDemoDietIds.add(dietId)
}

export function deleteDemoDiet(dietId: string) {
  leftDemoDietIds.add(dietId)
  demoMealTypeSchedules.delete(dietId)
}

export function getDemoInvitations() {
  return demoInvitationResponse ? [] : initialInvitations
}

export function respondToDemoInvitation(id: string, response: 'accept' | 'decline') {
  if (id === initialInvitations[0].id) demoInvitationResponse = response === 'accept' ? 'accepted' : 'declined'
}

export const initialMeals: Meal[] = [
  { id: '1', mealType: 'Café da manhã', description: 'Iogurte natural, banana, aveia e canela', mealDate: '2026-09-04', authorId: '1', authorName: 'Marina Alves', createdAt: '2026-09-04T07:40:00Z' },
  { id: '2', mealType: 'Almoço', description: 'Arroz integral, feijão, frango grelhado e salada', mealDate: '2026-09-04', authorId: '1', authorName: 'Marina Alves', createdAt: '2026-09-04T12:25:00Z' },
  { id: '3', mealType: 'Jantar', description: 'Omelete de legumes e folhas', mealDate: '2026-09-03', authorId: '2', authorName: 'Rafael Lima', createdAt: '2026-09-03T19:50:00Z' },
]

export const initialMembers: Member[] = [
  { userId: '1', fullName: 'Marina Alves', email: 'marina@exemplo.com', role: 'OWNER' },
  { userId: '2', fullName: 'Rafael Lima', email: 'rafael@exemplo.com', role: 'MEMBER' },
]
