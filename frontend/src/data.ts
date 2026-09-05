import type { Diet, Meal, Member } from './types'

export const initialDiets: Diet[] = [
  { id: '1', name: 'Equilíbrio diário', startDate: '2026-09-01', endDate: '2026-09-30' },
  { id: '2', name: 'Mais energia', startDate: '2026-10-01', endDate: '2026-10-21' },
]

export const initialMeals: Meal[] = [
  { id: '1', mealType: 'Café da manhã', description: 'Iogurte natural, banana, aveia e canela', mealDate: '2026-09-04', authorId: '1', authorName: 'Marina Alves', createdAt: '2026-09-04T07:40:00Z' },
  { id: '2', mealType: 'Almoço', description: 'Arroz integral, feijão, frango grelhado e salada', mealDate: '2026-09-04', authorId: '1', authorName: 'Marina Alves', createdAt: '2026-09-04T12:25:00Z' },
  { id: '3', mealType: 'Jantar', description: 'Omelete de legumes e folhas', mealDate: '2026-09-03', authorId: '2', authorName: 'Rafael Lima', createdAt: '2026-09-03T19:50:00Z' },
]

export const initialMembers: Member[] = [
  { userId: '1', fullName: 'Marina Alves', email: 'marina@exemplo.com', role: 'OWNER' },
  { userId: '2', fullName: 'Rafael Lima', email: 'rafael@exemplo.com', role: 'MEMBER' },
]
