export type User = {
  id: string
  email: string
  fullName: string
  weightKg?: number | null
  heightCm?: number | null
}

export type Diet = {
  id: string
  name: string
  startDate: string
  endDate: string
}

export type Meal = {
  id: string
  mealType: string
  description: string
  mealDate: string
  photoUrl?: string | null
  authorId: string
  authorName: string
  createdAt: string
  syncStatus?: 'pending' | 'syncing' | 'failed'
  syncError?: string
  operationId?: string
}

export type Member = {
  userId: string
  email: string
  fullName: string
  role: 'OWNER' | 'MEMBER'
}

export type Invitation = {
  id: string
  dietId: string
  dietName: string
  inviterId: string
  inviterName: string
  createdAt: string
}

export type AuthResponse = {
  token: string
  userId: string
  email: string
  fullName: string
}

export type LoginRequest = { email: string; password: string }
export type RegisterRequest = LoginRequest & { fullName: string }
export type CreateDietRequest = Omit<Diet, 'id'>
export type CreateMealRequest = Pick<Meal, 'mealType' | 'description' | 'mealDate' | 'photoUrl'>
export type InviteMemberRequest = Pick<User, 'email'>
export type LeaveDietRequest = { successorId: string | null }
export type UpdateProfileRequest = Pick<User, 'fullName' | 'weightKg' | 'heightCm'>
