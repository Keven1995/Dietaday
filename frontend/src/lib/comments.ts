import type { Meal, MealComment } from '../types'
import { dietResourceKey } from './resourceCache'

export function mealCommentCount(meal: Meal) {
  return meal.commentCount ?? 0
}

export function commentsResourceKey(dietId: string, mealId: string) {
  return dietResourceKey(dietId, `meals:${mealId}:comments`)
}

export function commentsPath(dietId: string, mealId: string) {
  return `/diets/${dietId}/meals/${mealId}/comments`
}

export function commentPath(dietId: string, mealId: string, commentId: string) {
  return `${commentsPath(dietId, mealId)}/${commentId}`
}

export function commentReactionPath(dietId: string, mealId: string, commentId: string) {
  return `${commentPath(dietId, mealId, commentId)}/reaction`
}

export function chronologicalComments(comments: MealComment[]) {
  return [...comments].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function replaceComment(comments: MealComment[], comment: MealComment) {
  return chronologicalComments(comments.map((current) => current.id === comment.id ? comment : current))
}

export function removeComment(comments: MealComment[], commentId: string) {
  return comments.filter((comment) => comment.id !== commentId)
}
