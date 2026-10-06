import { useEffect, useState, type CSSProperties } from 'react'

type Bat = { id: number; top: number; duration: number }

const MIN_SPAWN_DELAY = 30_000
const MAX_SPAWN_DELAY = 90_000
const BAT_LIFETIME = 9_000

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function HalloweenDecorations({ enabled }: { enabled: boolean }) {
  const [bats, setBats] = useState<Bat[]>([])

  useEffect(() => {
    if (!enabled || !window.matchMedia('(pointer: fine)').matches) return

    let nextId = 0
    let spawnTimer = 0
    let removeTimer = 0
    let disposed = false

    const scheduleSpawn = () => {
      spawnTimer = window.setTimeout(() => {
        if (disposed) return
        const count = randomBetween(1, 3)
        const nextBats = Array.from({ length: count }, () => ({
          id: nextId++,
          top: randomBetween(12, 72),
          duration: randomBetween(7, 10),
        }))
        setBats(nextBats)
        removeTimer = window.setTimeout(() => setBats([]), BAT_LIFETIME)
        scheduleSpawn()
      }, randomBetween(MIN_SPAWN_DELAY, MAX_SPAWN_DELAY))
    }

    scheduleSpawn()
    return () => {
      disposed = true
      window.clearTimeout(spawnTimer)
      window.clearTimeout(removeTimer)
    }
  }, [enabled])

  if (!bats.length) return null

  return <div className="halloween-bats" aria-hidden="true">
    {bats.map((bat) => <span
      className="halloween-bat"
      key={bat.id}
      style={{ top: `${bat.top}vh`, '--bat-duration': `${bat.duration}s` } as CSSProperties}
    >🦇</span>)}
  </div>
}
