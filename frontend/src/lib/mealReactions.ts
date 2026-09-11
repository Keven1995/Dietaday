import type { MealReaction } from '../types'

export function optimisticReactions(current: MealReaction[], nextEmoji: string | null) {
  const reactions = current
    .map((reaction) => reaction.reactedByMe
      ? { ...reaction, count: reaction.count - 1, reactedByMe: false }
      : reaction)
    .filter((reaction) => reaction.count > 0)

  if (nextEmoji) {
    const existing = reactions.find((reaction) => reaction.emoji === nextEmoji)
    if (existing) {
      existing.count += 1
      existing.reactedByMe = true
    } else {
      reactions.push({ emoji: nextEmoji, count: 1, reactedByMe: true })
    }
  }

  return reactions.sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji))
}
