import { HalloweenBackground } from './HalloweenBackground'
import { HalloweenDecorations } from './HalloweenDecorations'
import { halloweenConfig } from './HalloweenConfig'

export default function HalloweenTheme({ intensity, reducedMotion }: { intensity: 'light' | 'full'; reducedMotion: boolean }) {
  return <div className="seasonal-theme-layer" aria-hidden="true">
    <HalloweenBackground ghosts={halloweenConfig.effects.ghosts} />
    {intensity === 'full' && !reducedMotion && halloweenConfig.effects.bats && <HalloweenDecorations enabled />}
  </div>
}
