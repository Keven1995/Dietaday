export type User = {
  id: string
  email: string
  fullName: string
  weightKg?: number | null
  heightCm?: number | null
  sex: UserSex
  emailVerified?: boolean
}

export type UserSex = 'MALE' | 'FEMALE' | 'NEUTRAL'

export type Diet = {
  id: string
  name: string
  startDate: string
  endDate: string
  competitiveMode: boolean
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
  sex: UserSex
}


export type LoginRequest = { email: string; password: string }
export type RegisterRequest = LoginRequest & { fullName: string; sex: UserSex }
export type CreateDietRequest = Omit<Diet, 'id'>
export type CreateMealRequest = Pick<Meal, 'mealType' | 'description' | 'mealDate' | 'photoUrl'>
export type InviteMemberRequest = Pick<User, 'email'>
export type LeaveDietRequest = { successorId: string | null }
export type UpdateProfileRequest = Pick<User, 'fullName' | 'weightKg' | 'heightCm' | 'sex'>

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

export type RankingParticipant = {
  position: number
  userId: string
  displayName: string
  officialPoints: number
  activeDays: number
  firstReachedAt: string | null
}

export type RankingResponse = {
  dietId: string
  status: 'ACTIVE' | 'FINALIZED'
  startDate: string
  endDate: string
  lastClosedDate: string | null
  currentUser: { userId: string; position: number; officialPoints: number; pendingPoints: number }
  participants: RankingParticipant[]
  page: { number: number; size: number; totalElements: number; totalPages: number }
  podium: { first: string | null; second: string | null; third: string | null } | null
}

export type RankingDetails = {
  userId: string
  pendingPoints: number
  mealCountByType: Record<string, number>
  eligibleWaterChecks: number
  events: Array<{ sourceType: string; mealType: string | null; eventDate: string; points: number; status: string }>
  page: { number: number; size: number; totalElements: number; totalPages: number }
}

export type RankingActivity = {
  eventId: string | null
  sourceType: 'MEAL' | 'WATER_CHECK' | null
  createdAt: string | null
}
