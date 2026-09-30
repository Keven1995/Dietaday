export function clampProgress(value: number, max = 100) {
  const safeMax = Math.max(1, max)
  return Math.min(safeMax, Math.max(0, value))
}

export function crossedThreshold(previous: number, current: number, threshold: number) {
  return previous < threshold && current >= threshold
}
