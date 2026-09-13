import { describe, expect, it } from 'vitest'
import type { Meal, MealComment } from '../types'
import { chronologicalComments, commentPath, commentReactionPath, commentsPath, commentsResourceKey, mealCommentCount, removeComment, replaceComment } from './comments'

const first: MealComment = { id: '1', mealId: 'm1', authorId: 'u1', authorName: 'Ana', content: 'Primeiro', createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z', reactions: [] }
const second: MealComment = { ...first, id: '2', content: 'Segundo', createdAt: '2026-01-01T11:00:00Z' }

describe('comment helpers', () => {
  it('supports old meals and creates an isolated cache key', () => {
    expect(mealCommentCount({ id: 'm1' } as Meal)).toBe(0)
    expect(commentsResourceKey('d1', 'm1')).toBe('diet:d1:meals:m1:comments')
  })

  it('builds comment endpoints scoped to their diet and meal', () => {
    expect(commentsPath('d1', 'm1')).toBe('/diets/d1/meals/m1/comments')
    expect(commentPath('d1', 'm1', 'c1')).toBe('/diets/d1/meals/m1/comments/c1')
    expect(commentReactionPath('d1', 'm1', 'c1')).toBe('/diets/d1/meals/m1/comments/c1/reaction')
  })

  it('sorts, replaces and removes comments without mutating the input', () => {
    const original = [second, first]
    expect(chronologicalComments(original).map(({ id }) => id)).toEqual(['1', '2'])
    expect(replaceComment(original, { ...second, content: 'Editado' })[1].content).toBe('Editado')
    expect(removeComment(original, '1')).toEqual([second])
    expect(original).toEqual([second, first])
  })
})
