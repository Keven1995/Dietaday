import { api, isDemoMode } from './api'
import type { WaterToday } from '../types'
import { createUuid } from './uuid'
import { readCachedResource } from './resourceCache'

const DEFAULT_GOAL_ML = 2000
export const WATER_CACHE_RESOURCE = 'water:today'

function storageKey(userId: string) {
  return `Dietaday_water_${userId}`
}

export function todayKey() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function createDemoState(userId: string): WaterToday {
  const stored = localStorage.getItem(storageKey(userId))
  if (stored) {
    try {
      const value = JSON.parse(stored) as WaterToday
      if (value.date === todayKey()) return value
    } catch {
      localStorage.removeItem(storageKey(userId))
    }
  }
  return { date: todayKey(), goalMl: DEFAULT_GOAL_ML, consumedMl: 0, remainingMl: DEFAULT_GOAL_ML, percentage: 0, checks: [] }
}

function saveDemoState(userId: string, state: WaterToday) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state))
  return state
}

export function readCachedWater(userId: string) {
  const cached = readCachedResource<WaterToday>(userId, WATER_CACHE_RESOURCE)
  if (!cached || cached.data.date === todayKey()) return cached?.data ?? null
  return {
    ...cached.data,
    date: todayKey(),
    consumedMl: 0,
    remainingMl: cached.data.goalMl,
    percentage: 0,
    checks: [],
  }
}

export async function getWaterToday(token: string | null, userId: string): Promise<WaterToday> {
  if (isDemoMode) return createDemoState(userId)
  return api<WaterToday>('/water/today', { token })
}

export async function updateWaterGoal(token: string | null, userId: string, goalMl: number): Promise<WaterToday> {
  if (isDemoMode) {
    const state = createDemoState(userId)
    const next: WaterToday = { ...state, goalMl, remainingMl: Math.max(0, goalMl - state.consumedMl), percentage: Math.min(100, Math.round(state.consumedMl * 100 / goalMl)) }
    return saveDemoState(userId, next)
  }
  return api<WaterToday>('/water/goal', { method: 'PUT', token, body: JSON.stringify({ goalMl }) })
}

export async function addWaterCheck(token: string | null, userId: string, amountMl: number): Promise<WaterToday> {
  if (isDemoMode) {
    const state = createDemoState(userId)
    if (amountMl > state.remainingMl) throw new Error('Esse check ultrapassa o volume restante da sua meta.')
    const consumedMl = state.consumedMl + amountMl
    const next: WaterToday = {
      ...state,
      consumedMl,
      remainingMl: Math.max(0, state.goalMl - consumedMl),
      percentage: Math.min(100, Math.round(consumedMl * 100 / state.goalMl)),
      checks: [...state.checks, { id: createUuid(), amountMl, createdAt: new Date().toISOString() }],
    }
    return saveDemoState(userId, next)
  }
  return api<WaterToday>('/water/checks', { method: 'POST', token, body: JSON.stringify({ amountMl }) })
}
