import { api } from './api'
import { API_URL } from './apiConfig'
import type { SyncTelemetryPhase } from './syncTelemetry'

type CloudinaryResponse = { secure_url?: string; error?: { message?: string } }
type CloudinarySignature = {
  apiKey: string
  timestamp: number
  signature: string
  uploadUrl: string
}

export class PhotoUploadError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'PhotoUploadError'
    this.status = status
  }
}

function isCloudinaryResponse(value: unknown): value is CloudinaryResponse {
  return typeof value === 'object' && value !== null
}

export const isPhotoUploadConfigured = Boolean(API_URL)

export async function compressPhoto(file: File) {
  if (file.size <= 500 * 1024 || file.type === 'image/gif') return file
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
      type: blob.type,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(source)
  }
}

export async function uploadPhoto(
  file: Blob,
  fileName: string,
  token: string,
  signal?: AbortSignal,
  onPhase?: (phase: SyncTelemetryPhase) => Promise<void>,
) {
  await onPhase?.('signature')
  const signedUpload = await api<CloudinarySignature>('/uploads/signature', {
    method: 'POST',
    token,
    signal,
  })
  await onPhase?.('cloudinary-upload')
  const body = new FormData()
  body.append('file', file, fileName)
  body.append('api_key', signedUpload.apiKey)
  body.append('timestamp', String(signedUpload.timestamp))
  body.append('signature', signedUpload.signature)
  const endpoint = signedUpload.uploadUrl
  let response: Response
  try {
    response = await fetch(endpoint, { method: 'POST', body, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new PhotoUploadError(
      `Falha de rede no upload (sem resposta HTTP). Arquivo: ${fileName}, ${file.type || 'tipo desconhecido'}, ${file.size} bytes. `
      + `Endpoint: ${endpoint}`,
      0,
    )
  }
  const value: unknown = await response.json().catch(() => null)
  const data = isCloudinaryResponse(value) ? value : null
  if (!response.ok || !data?.secure_url) {
    const cloudinaryMessage = data?.error?.message || 'Resposta sem secure_url.'
    throw new PhotoUploadError(
      `Cloudinary HTTP ${response.status}: ${cloudinaryMessage} `
      + `Arquivo: ${fileName}, ${file.type || 'tipo desconhecido'}, ${file.size} bytes. Upload assinado.`,
      response.status,
    )
  }
  return data.secure_url
}
