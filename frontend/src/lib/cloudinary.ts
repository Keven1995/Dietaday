const cloudName: string | undefined = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset: string | undefined = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

type CloudinaryResponse = { secure_url?: string; error?: { message?: string } }

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

export const isPhotoUploadConfigured = Boolean(cloudName && uploadPreset)

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

export async function uploadPhoto(file: Blob, fileName: string, signal?: AbortSignal) {
  if (!cloudName || !uploadPreset) {
    throw new Error('O upload de fotos não está configurado.')
  }
  const body = new FormData()
  body.append('file', file, fileName)
  body.append('upload_preset', uploadPreset)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
    signal,
  })
  const value: unknown = await response.json().catch(() => null)
  const data = isCloudinaryResponse(value) ? value : null
  if (!response.ok || !data?.secure_url) {
    throw new PhotoUploadError(data?.error?.message || 'Não foi possível enviar a foto ao Cloudinary.', response.status)
  }
  return data.secure_url
}
