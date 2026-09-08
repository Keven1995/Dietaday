import { useEffect, useState } from 'react'

const FRUIT_IDS = ['apple', 'banana', 'grape', 'strawberry', 'orange', 'watermelon'] as const
type FruitId = typeof FRUIT_IDS[number]

type Fruit = {
  label: string
  pixels: string[]
  colors: Record<string, string>
}

const FRUITS: Record<FruitId, Fruit> = {
  apple: {
    label: 'Maçã',
    pixels: ['....GG......', '...GG.......', '..RRRRRR....', '.RRRRRRRR...', '.RHRRRRRR...', '.RRRRRRRR...', '..RRRRRR....', '...RRRR.....'],
    colors: { R: '#df493b', H: '#ff8a63', G: '#39764b' },
  },
  banana: {
    label: 'Banana',
    pixels: ['.YY.........', '..YY........', '..YYY.......', '...YYY......', '....YYYY....', '.....YYYY...', '......YYYB..', '.......BB...'],
    colors: { Y: '#f4c542', B: '#9a642e' },
  },
  grape: {
    label: 'Uva',
    pixels: ['....GG......', '...GGG......', '..PP.PP.....', '.PPPPPP.....', '..PPPP......', '...PP.......', '...PP.......', '............'],
    colors: { P: '#7b4ba8', G: '#4a8046' },
  },
  strawberry: {
    label: 'Morango',
    pixels: ['..GGGG......', '.G.GG.G.....', '.RRRRRR.....', '..RYRY......', '..RRRR......', '...RY.......', '...RR.......', '............'],
    colors: { R: '#e64b45', Y: '#ffd66b', G: '#42854f' },
  },
  orange: {
    label: 'Laranja',
    pixels: ['.....G......', '...GGG......', '..OOOOO.....', '.OOOOOOO....', '.OOHOOOO....', '.OOOOOOO....', '..OOOOO.....', '............'],
    colors: { O: '#f18a32', H: '#ffc15c', G: '#43804a' },
  },
  watermelon: {
    label: 'Melancia',
    pixels: ['.GGGGGGGG...', '.GRRRRRRG...', '..GRBRRG....', '..GRRBRG....', '...GRRG.....', '....GG......', '............', '............'],
    colors: { R: '#ef5d62', B: '#56382f', G: '#459557' },
  },
}

export type MemoryCardData = { id: string; fruitId: FruitId }
export const MEMORY_FRUIT_COUNT = FRUIT_IDS.length

export function createMemoryDeck(random = Math.random): MemoryCardData[] {
  const cards = FRUIT_IDS.flatMap((fruitId) => [
    { id: `${fruitId}-1`, fruitId },
    { id: `${fruitId}-2`, fruitId },
  ])
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[cards[index], cards[target]] = [cards[target], cards[index]]
  }
  return cards
}

function PixelFruit({ fruitId }: { fruitId: FruitId }) {
  const fruit = FRUITS[fruitId]
  return (
    <svg className="pixel-fruit" viewBox={`0 0 ${fruit.pixels[0].length} ${fruit.pixels.length}`} shapeRendering="crispEdges" aria-hidden="true">
      {fruit.pixels.flatMap((row, y) => [...row].map((pixel, x) => (
        pixel === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fruit.colors[pixel]} />
      )))}
    </svg>
  )
}

export function MemoryGame() {
  const [deck, setDeck] = useState(createMemoryDeck)
  const [openCards, setOpenCards] = useState<string[]>([])
  const [matchedFruits, setMatchedFruits] = useState<Set<FruitId>>(() => new Set())
  const [moves, setMoves] = useState(0)
  const [result, setResult] = useState('')

  useEffect(() => {
    if (openCards.length !== 2) return
    const first = deck.find((card) => card.id === openCards[0])
    const second = deck.find((card) => card.id === openCards[1])
    const timer = window.setTimeout(() => {
      if (first && second && first.fruitId === second.fruitId) {
        setMatchedFruits((current) => new Set(current).add(first.fruitId))
        setResult(`Par de ${FRUITS[first.fruitId].label} encontrado!`)
      } else {
        setResult('Essas frutas não formam um par. Tente novamente!')
      }
      setOpenCards([])
    }, first?.fruitId === second?.fruitId ? 450 : 800)
    return () => window.clearTimeout(timer)
  }, [deck, openCards])

  function reveal(card: MemoryCardData) {
    if (openCards.length >= 2 || openCards.includes(card.id) || matchedFruits.has(card.fruitId)) return
    if (openCards.length === 0) setResult('')
    setOpenCards((current) => [...current, card.id])
    if (openCards.length === 1) setMoves((current) => current + 1)
  }

  function restart() {
    setDeck(createMemoryDeck())
    setOpenCards([])
    setMatchedFruits(new Set())
    setMoves(0)
    setResult('')
  }

  const complete = matchedFruits.size === MEMORY_FRUIT_COUNT

  return (
    <section className="memory-game" aria-labelledby="memory-title">
      <div className="memory-heading">
        <div><h3 id="memory-title">Encontre os pares</h3><small>{moves} {moves === 1 ? 'jogada' : 'jogadas'}</small></div>
        <span>{matchedFruits.size}/{MEMORY_FRUIT_COUNT} pares</span>
      </div>
      <div className="memory-grid" aria-label="Jogo da memória com frutas">
        {deck.map((card, index) => {
          const visible = openCards.includes(card.id) || matchedFruits.has(card.fruitId)
          const matched = matchedFruits.has(card.fruitId)
          return (
            <button
              className={`memory-card${visible ? ' is-open' : ''}${matched ? ' is-matched' : ''}`}
              type="button"
              key={card.id}
              aria-disabled={matched || openCards.length === 2}
              aria-label={visible ? `${FRUITS[card.fruitId].label}${matched ? ', par encontrado' : ''}` : `Carta ${index + 1}, fechada`}
              aria-pressed={visible}
              onClick={() => reveal(card)}
            >
              <span className="memory-card-inner">
                <span className="memory-card-back" aria-hidden="true"><i>N</i></span>
                <span className="memory-card-front" aria-hidden="true"><PixelFruit fruitId={card.fruitId} /></span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="memory-result" aria-live="polite">
        {complete ? <><strong>Você encontrou todas as frutas!</strong><button type="button" onClick={restart}>Jogar novamente</button></> : <span>{result || 'O acesso continuará automaticamente quando tudo estiver pronto.'}</span>}
      </div>
    </section>
  )
}
