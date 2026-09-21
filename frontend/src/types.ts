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

export type MealReaction = {
  emoji: string
  count: number
  reactedByMe: boolean
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
  reactions?: MealReaction[]
  commentCount?: number
}

export type MealComment = {
  id: string
  mealId: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
  updatedAt: string
  reactions: MealReaction[]
}

export type CommentNotification = {
  id: string
  type: string
  dietId: string
  mealId: string
  mealDate: string
  commentId: string
  actorId: string
  actorName: string
  mealType: string
  createdAt: string
  readAt: string | null
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

export type WaterCheck = {
  id: string
  amountMl: number
  createdAt: string
}

export type WaterToday = {
  date: string
  goalMl: number
  consumedMl: number
  remainingMl: number
  percentage: number
  checks: WaterCheck[]
}
