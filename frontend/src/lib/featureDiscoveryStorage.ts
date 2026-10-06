import { FEATURE_CAMPAIGNS, type FeatureCampaignId } from './featureDiscovery'

const PREFERENCE_KEY_PREFIX = 'Dietaday_feature_discovery_v1:'
const SESSION_KEY_PREFIX = 'Dietaday_feature_discovery_session_v1:'
const STORE_VERSION = 1

export type FeatureDiscoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type FeatureCampaignAction = 'dismiss' | 'click' | 'complete'

export type FeatureCampaignPreference = {
  campaignId: FeatureCampaignId
  version: number
  dietId?: string
  exposureId?: string
  exposureDietId?: string
  viewedAt?: string
  dismissedAt?: string
  clickedAt?: string
  completedAt?: string
}

type StoredPreferences = {
  schemaVersion: typeof STORE_VERSION
  entries: Record<string, FeatureCampaignPreference>
}

const memoryPreferences = new Map<string, StoredPreferences>()
const memorySessionValues = new Map<string, boolean>()

function browserStorage(kind: 'local' | 'session'): FeatureDiscoveryStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function userPreferenceKey(userId: string) {
  return `${PREFERENCE_KEY_PREFIX}${encodeURIComponent(userId)}`
}

function userSessionKey(userId: string) {
  return `${SESSION_KEY_PREFIX}${encodeURIComponent(userId)}`
}

function preferenceEntryKey(campaignId: FeatureCampaignId, version: number, dietId?: string) {
  const scope = dietId ? `diet:${encodeURIComponent(dietId)}` : 'user'
  return `${campaignId}:v${version}:${scope}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isCampaignPreference(value: unknown): value is FeatureCampaignPreference {
  if (!isRecord(value)) return false
  const validCampaign = FEATURE_CAMPAIGNS.some((campaign) => campaign.id === value.campaignId)
  const validVersion = Number.isInteger(value.version) && Number(value.version) > 0
  const validDiet = value.dietId === undefined || typeof value.dietId === 'string'
  const validExposure = (value.exposureId === undefined || typeof value.exposureId === 'string')
    && (value.exposureDietId === undefined || typeof value.exposureDietId === 'string')
  const validActions = ['viewedAt', 'dismissedAt', 'clickedAt', 'completedAt']
    .every((field) => value[field] === undefined || isTimestamp(value[field]))
  return validCampaign && validVersion && validDiet && validExposure && validActions
}

function parseStore(value: unknown): StoredPreferences | null {
  if (!isRecord(value) || value.schemaVersion !== STORE_VERSION || !isRecord(value.entries)) return null
  const entries: Record<string, FeatureCampaignPreference> = {}
  for (const [key, preference] of Object.entries(value.entries)) {
    if (isCampaignPreference(preference)) entries[key] = preference
  }
  return { schemaVersion: STORE_VERSION, entries }
}

function cloneStore(store: StoredPreferences): StoredPreferences {
  return {
    schemaVersion: STORE_VERSION,
    entries: Object.fromEntries(Object.entries(store.entries).map(([key, value]) => [key, { ...value }])),
  }
}

function newestTimestamp(left?: string, right?: string) {
  if (!left) return right
  if (!right) return left
  return Date.parse(left) >= Date.parse(right) ? left : right
}

function mergeStores(persisted: StoredPreferences, memory: StoredPreferences | undefined): StoredPreferences {
  if (!memory) return cloneStore(persisted)
  const entries = cloneStore(persisted).entries
  for (const [key, local] of Object.entries(memory.entries)) {
    const remote = entries[key]
    if (!remote) {
      entries[key] = { ...local }
      continue
    }
    const localViewIsNewer = Boolean(local.viewedAt)
      && (!remote.viewedAt || Date.parse(local.viewedAt!) > Date.parse(remote.viewedAt))
    const exposureSource = localViewIsNewer ? local : remote
    const viewedAt = newestTimestamp(remote.viewedAt, local.viewedAt)
    const dismissedAt = newestTimestamp(remote.dismissedAt, local.dismissedAt)
    const clickedAt = newestTimestamp(remote.clickedAt, local.clickedAt)
    const completedAt = newestTimestamp(remote.completedAt, local.completedAt)
    const merged: FeatureCampaignPreference = {
      ...remote,
      ...(viewedAt ? { viewedAt } : {}),
      ...(dismissedAt ? { dismissedAt } : {}),
      ...(clickedAt ? { clickedAt } : {}),
      ...(completedAt ? { completedAt } : {}),
    }
    if (exposureSource.exposureId) merged.exposureId = exposureSource.exposureId
    else delete merged.exposureId
    if (exposureSource.exposureDietId) merged.exposureDietId = exposureSource.exposureDietId
    else delete merged.exposureDietId
    entries[key] = merged
  }
  return { schemaVersion: STORE_VERSION, entries }
}

function readStore(userId: string, storage: FeatureDiscoveryStorage | null): StoredPreferences {
  const key = userPreferenceKey(userId)
  const memory = memoryPreferences.get(key)
  if (!storage) return cloneStore(memory ?? { schemaVersion: STORE_VERSION, entries: {} })

  let serialized: string | null
  try {
    serialized = storage.getItem(key)
  } catch {
    return cloneStore(memory ?? { schemaVersion: STORE_VERSION, entries: {} })
  }
  if (serialized === null) return cloneStore(memory ?? { schemaVersion: STORE_VERSION, entries: {} })

  try {
    const persisted = parseStore(JSON.parse(serialized) as unknown)
    if (!persisted) throw new Error('Invalid feature discovery preferences')
    const merged = mergeStores(persisted, memory)
    memoryPreferences.set(key, merged)
    return cloneStore(merged)
  } catch {
    try {
      storage.removeItem(key)
    } catch {
      // Corrupt or unavailable storage must not interrupt the app.
    }
    return cloneStore(memory ?? { schemaVersion: STORE_VERSION, entries: {} })
  }
}

function writeStore(userId: string, store: StoredPreferences, storage: FeatureDiscoveryStorage | null) {
  const key = userPreferenceKey(userId)
  const snapshot = cloneStore(store)
  memoryPreferences.set(key, snapshot)
  try {
    storage?.setItem(key, JSON.stringify(snapshot))
  } catch {
    // Keep the update in memory if browser storage is unavailable.
  }
}

export function readFeatureCampaignPreference(
  userId: string,
  campaignId: FeatureCampaignId,
  version: number,
  dietId?: string,
  storage: FeatureDiscoveryStorage | null = browserStorage('local'),
): FeatureCampaignPreference | null {
  const store = readStore(userId, storage)
  const preference = store.entries[preferenceEntryKey(campaignId, version, dietId)]
  return preference ? { ...preference } : null
}

export function readFeatureCampaignPreferences(
  userId: string,
  storage: FeatureDiscoveryStorage | null = browserStorage('local'),
): FeatureCampaignPreference[] {
  return Object.values(readStore(userId, storage).entries).map((preference) => ({ ...preference }))
}

export function recordFeatureCampaignExposure(
  userId: string,
  campaignId: FeatureCampaignId,
  version: number,
  exposureId: string,
  options: { dietId?: string; eventDietId?: string; now?: number; storage?: FeatureDiscoveryStorage | null } = {},
): FeatureCampaignPreference {
  const storage = options.storage === undefined ? browserStorage('local') : options.storage
  const store = readStore(userId, storage)
  const key = preferenceEntryKey(campaignId, version, options.dietId)
  const current = store.entries[key] ?? {
    campaignId,
    version,
    ...(options.dietId ? { dietId: options.dietId } : {}),
  }
  const preference: FeatureCampaignPreference = {
    ...current,
    exposureId,
    viewedAt: new Date(options.now ?? Date.now()).toISOString(),
  }
  if (options.eventDietId) preference.exposureDietId = options.eventDietId
  else delete preference.exposureDietId
  store.entries[key] = preference
  writeStore(userId, store, storage)
  return { ...preference }
}

export function recordFeatureCampaignAction(
  userId: string,
  campaignId: FeatureCampaignId,
  version: number,
  action: FeatureCampaignAction,
  options: { dietId?: string; now?: number; storage?: FeatureDiscoveryStorage | null } = {},
): FeatureCampaignPreference {
  const storage = options.storage === undefined ? browserStorage('local') : options.storage
  const store = readStore(userId, storage)
  const key = preferenceEntryKey(campaignId, version, options.dietId)
  const current = store.entries[key] ?? {
    campaignId,
    version,
    ...(options.dietId ? { dietId: options.dietId } : {}),
  }
  const timestamp = new Date(options.now ?? Date.now()).toISOString()
  const actionField = {
    dismiss: 'dismissedAt',
    click: 'clickedAt',
    complete: 'completedAt',
  } as const
  const preference = { ...current, [actionField[action]]: timestamp }
  store.entries[key] = preference
  writeStore(userId, store, storage)
  return { ...preference }
}

export function hasShownOptionalSuggestionThisSession(
  userId: string,
  storage: FeatureDiscoveryStorage | null = browserStorage('session'),
): boolean {
  const key = userSessionKey(userId)
  const memoryValue = memorySessionValues.get(key)
  if (memoryValue !== undefined) return memoryValue
  try {
    const shown = storage?.getItem(key) === '1'
    memorySessionValues.set(key, shown)
    return shown
  } catch {
    return false
  }
}

export function markOptionalSuggestionShownThisSession(
  userId: string,
  storage: FeatureDiscoveryStorage | null = browserStorage('session'),
): boolean {
  if (hasShownOptionalSuggestionThisSession(userId, storage)) return false
  memorySessionValues.set(userSessionKey(userId), true)
  try {
    storage?.setItem(userSessionKey(userId), '1')
  } catch {
    // The in-memory cap still applies for this loaded tab session.
  }
  return true
}

export function clearFeatureDiscoverySession(
  userId: string,
  storage: FeatureDiscoveryStorage | null = browserStorage('session'),
) {
  memorySessionValues.set(userSessionKey(userId), false)
  try {
    storage?.removeItem(userSessionKey(userId))
  } catch {
    // Logout must proceed even if browser storage is unavailable.
  }
}
