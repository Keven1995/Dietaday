import { api, isDemoMode } from './api'
import type { WaterHistory, WaterToday } from '../types'
import { createUuid } from './uuid'
import { readCachedResource, writeCachedResource } from './resourceCache'

const DEFAULT_GOAL_ML = 2000
export const WATER_CACHE_RESOURCE = 'water:today'
export const WATER_CHECK_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]
export const WATER_GOAL_OPTIONS = Array.from({ length: 41 }, (_, index) => 2000 + index * 50)
const inFlightWaterHistory = new Map<string, Promise<WaterHistory>>()

export function getAvailableWaterCheckOptions(remainingMl: number) {
  return {
    regular: WATER_CHECK_OPTIONS.filter((amount) => amount <= remainingMl),
    exactRemainderMl: remainingMl > 0 && remainingMl < 500 ? remainingMl : null,
  }
}

export function waterHistoryCacheResource(month: string, dietId?: string | null) {
  return `${WATER_CACHE_RESOURCE}:history:${dietId ? `diet:${dietId}` : 'general'}:${month}`
}

export function readCachedWaterHistory(userId: string, month: string, dietId?: string | null) {
  return readCachedResource<WaterHistory>(userId, waterHistoryCacheResource(month, dietId))
}

export async function getWaterHistory(
  token: string | null,
  userId: string,
  month: string,
  dietId?: string | null,
): Promise<WaterHistory> {
  if (isDemoMode) return { month, days: [] }
  const resource = waterHistoryCacheResource(month, dietId)
  const requestKey = `${userId}:${resource}`
  const existingRequest = inFlightWaterHistory.get(requestKey)
  if (existingRequest) return existingRequest

  const path = dietId
    ? `/diets/${dietId}/water/history?month=${encodeURIComponent(month)}`
    : `/water/history?month=${encodeURIComponent(month)}`
  const request = api<WaterHistory>(path, { token })
    .then((history) => {
      writeCachedResource(userId, resource, history)
      return history
    })
    .finally(() => {
      if (inFlightWaterHistory.get(requestKey) === request) inFlightWaterHistory.delete(requestKey)
    })
  inFlightWaterHistory.set(requestKey, request)
  return request
}

function waterResource(dietId?: string | null) {
  return dietId ? `${WATER_CACHE_RESOURCE}:${dietId}` : WATER_CACHE_RESOURCE
}

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

export function readCachedWater(userId: string, dietId?: string | null) {
  const cached = readCachedResource<WaterToday>(userId, waterResource(dietId))
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

export async function getWaterToday(token: string | null, userId: string, dietId?: string | null): Promise<WaterToday> {
  if (isDemoMode) return createDemoState(userId)
  return api<WaterToday>(dietId ? `/diets/${dietId}/water/today` : '/water/today', { token })
}

export async function updateWaterGoal(token: string | null, userId: string, goalMl: number, dietId?: string | null): Promise<WaterToday> {
  if (isDemoMode) {
    const state = createDemoState(userId)
    const next: WaterToday = { ...state, goalMl, remainingMl: Math.max(0, goalMl - state.consumedMl), percentage: Math.min(100, Math.round(state.consumedMl * 100 / goalMl)) }
    return saveDemoState(userId, next)
  }
  return api<WaterToday>(dietId ? `/diets/${dietId}/water/goal` : '/water/goal', { method: 'PUT', token, body: JSON.stringify({ goalMl }) })
}

export async function addWaterCheck(token: string | null, userId: string, amountMl: number, dietId?: string | null): Promise<WaterToday> {
  if (isDemoMode) {
    const state = createDemoState(userId)
    if (amountMl > state.remainingMl) throw new Error('Esse check ultrapassa o volume restante da sua meta.')
    const isRegularCheck = amountMl >= 500 && amountMl <= 4000 && amountMl % 500 === 0
    const isExactRemainder = amountMl > 0 && amountMl < 500 && amountMl === state.remainingMl
    if (!isRegularCheck && !isExactRemainder) {
      throw new Error('Checks abaixo de 500 ml só podem registrar exatamente o restante da meta.')
    }
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
  return api<WaterToday>(dietId ? `/diets/${dietId}/water/checks` : '/water/checks', { method: 'POST', token, body: JSON.stringify({ amountMl }) })
}
