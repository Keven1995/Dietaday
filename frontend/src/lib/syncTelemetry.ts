import { api } from './api'

export type SyncTelemetryPhase = 'signature' | 'cloudinary-upload' | 'meal-create' | 'completed'

type SyncTelemetryEvent = {
  operationId: string
  phase: SyncTelemetryPhase
  attempt: number
  durationMs?: number
  httpStatus?: number
  fileType?: string
  fileSizeBytes?: number
}

export async function reportSyncEvent(token: string, event: SyncTelemetryEvent) {
  try {
    await api<void>('/telemetry/sync', {
      method: 'POST',
      token,
      body: JSON.stringify(event),
    })
  } catch {
    // Telemetry must never block or change the synchronization result.
  }
}
