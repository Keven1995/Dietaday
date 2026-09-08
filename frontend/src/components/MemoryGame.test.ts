import { describe, expect, it } from 'vitest'
import { createMemoryDeck, MEMORY_FRUIT_COUNT } from './MemoryGame'

describe('createMemoryDeck', () => {
  it('creates two unique cards for every fruit', () => {
    const deck = createMemoryDeck(() => 0.5)
    const counts = new Map<string, number>()
    for (const card of deck) counts.set(card.fruitId, (counts.get(card.fruitId) ?? 0) + 1)

    expect(deck).toHaveLength(MEMORY_FRUIT_COUNT * 2)
    expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length)
    expect([...counts.values()]).toEqual(Array(MEMORY_FRUIT_COUNT).fill(2))
  })
})
