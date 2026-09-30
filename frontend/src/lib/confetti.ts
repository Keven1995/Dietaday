export type ConfettiVariant = 'daily-goal' | 'hydration-goal' | 'streak' | 'ranking-finalized'

type ConfettiConfig = {
  count: number
  colors: readonly string[]
  spread: number
  fall: number
}

export type ConfettiPiece = {
  left: string
  color: string
  x: number
  y: number
  rotate: number
  delay: number
  width: number
  height: number
  ribbon: boolean
}

const CONFIG: Record<ConfettiVariant, ConfettiConfig> = {
  'daily-goal': { count: 24, colors: ['#ef8a63', '#f4c95d', '#7eb39a'], spread: 46, fall: 90 },
  'hydration-goal': { count: 22, colors: ['#55b8c3', '#b8e5df', '#f4c95d'], spread: 40, fall: 82 },
  streak: { count: 20, colors: ['#ef8a63', '#f4c95d', '#d96b48'], spread: 38, fall: 76 },
  'ranking-finalized': { count: 34, colors: ['#f4c95d', '#e19b30', '#d9e3d9', '#ef8a63'], spread: 58, fall: 112 },
}

export function createConfettiPieces(variant: ConfettiVariant): ConfettiPiece[] {
  const config = CONFIG[variant]
  return Array.from({ length: config.count }, (_, index) => {
    const normalized = (index * 37 + variant.length * 11) % 96 + 2
    const direction = index % 2 === 0 ? 1 : -1
    return {
      left: `${normalized}%`,
      color: config.colors[index % config.colors.length],
      x: direction * (12 + (index * 17) % config.spread),
      y: config.fall + (index % 5) * 9,
      rotate: direction * (90 + (index * 47) % 270),
      delay: (index % 8) * 0.035,
      width: 5 + index % 5,
      height: 9 + (index * 3) % 8,
      ribbon: index % 4 === 0,
    }
  })
}
