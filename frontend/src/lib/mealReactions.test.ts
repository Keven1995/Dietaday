import { describe, expect, it } from 'vitest'
import { optimisticReactions } from './mealReactions'

describe('optimisticReactions', () => {
  it('adds, changes and removes the current user reaction', () => {
    const added = optimisticReactions([{ emoji: '❤️', count: 2, reactedByMe: false }], '😂')
    expect(added).toEqual([
      { emoji: '❤️', count: 2, reactedByMe: false },
      { emoji: '😂', count: 1, reactedByMe: true },
    ])

    const changed = optimisticReactions(added, '❤️')
    expect(changed).toEqual([{ emoji: '❤️', count: 3, reactedByMe: true }])

    expect(optimisticReactions(changed, null)).toEqual([
      { emoji: '❤️', count: 2, reactedByMe: false },
    ])
  })

  it('does not mutate the server response used for rollback', () => {
    const original = [{ emoji: '👍', count: 1, reactedByMe: true }]
    optimisticReactions(original, '🙏')
    expect(original).toEqual([{ emoji: '👍', count: 1, reactedByMe: true }])
  })
})
