import { api } from './api'
import { API_URL } from './apiConfig'
import type { SyncTelemetryPhase } from './syncTelemetry'

type CloudinaryResponse = { secure_url?: string; error?: { message?: string } }
type UploadProgressHandler = (progress: number) => void
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

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

export function validatePhoto(file: File) {
  if (!ALLOWED_PHOTO_TYPES.has(file.type.toLowerCase())) {
    throw new PhotoUploadError('Escolha uma imagem JPG, PNG, WEBP, GIF ou HEIC.', 400)
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoUploadError('A foto deve ter no máximo 10 MB.', 413)
  }
}

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
  onProgress?: UploadProgressHandler,
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
  onProgress?.(0)
  const { status, value } = await uploadWithProgress(endpoint, body, signal, onProgress).catch((error: unknown) => {
    if (signal?.aborted) throw error
    throw new PhotoUploadError(
      `Falha de rede no upload (sem resposta HTTP). Arquivo: ${fileName}, ${file.type || 'tipo desconhecido'}, ${file.size} bytes. `
      + `Endpoint: ${endpoint}`,
      0,
    )
  })
  const data = isCloudinaryResponse(value) ? value : null
  if (status < 200 || status >= 300 || !data?.secure_url) {
    const cloudinaryMessage = data?.error?.message || 'Resposta sem secure_url.'
    throw new PhotoUploadError(
      `Cloudinary HTTP ${status}: ${cloudinaryMessage} `
      + `Arquivo: ${fileName}, ${file.type || 'tipo desconhecido'}, ${file.size} bytes. Upload assinado.`,
      status,
    )
  }
  onProgress?.(100)
  await onPhase?.('cloudinary-uploaded')
  return data.secure_url
}

function uploadWithProgress(endpoint: string, body: FormData, signal: AbortSignal | undefined, onProgress?: UploadProgressHandler) {
  return new Promise<{ status: number; value: unknown }>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const abort = () => request.abort()

    request.open('POST', endpoint)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100))
    })
    request.addEventListener('load', () => {
      cleanup()
      let value: unknown
      try {
        value = JSON.parse(request.responseText || 'null') as unknown
      } catch {
        value = null
      }
      resolve({ status: request.status, value })
    })
    request.addEventListener('error', () => {
      cleanup()
      reject(new Error('Falha de rede no upload.'))
    })
    request.addEventListener('abort', () => {
      cleanup()
      reject(new DOMException('Upload cancelado.', 'AbortError'))
    })
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }
    request.send(body)
  })
}
