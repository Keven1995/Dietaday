import { Camera, Check, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { localDateKey } from '../lib/date'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { CreateMealRequest, Meal } from '../types'

const cloudName: string | undefined = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset: string | undefined = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

type CloudinaryResponse = { secure_url?: string; error?: { message?: string } }

function isCloudinaryResponse(value: unknown): value is CloudinaryResponse {
  return typeof value === 'object' && value !== null
}

async function uploadPhoto(file: File, signal: AbortSignal) {
  if (!cloudName || !uploadPreset) {
    throw new Error('O upload de fotos não está configurado. Defina VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET ou remova a foto.')
  }

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body, signal })
  const value: unknown = await response.json().catch(() => null)
  const data = isCloudinaryResponse(value) ? value : null
  if (!response.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || 'Não foi possível enviar a foto ao Cloudinary.')
  }
  return data.secure_url
}

function PhotoField({ preview, onChoose, onRemove }: { preview: string; onChoose: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  return (
    <div>
      <span className="field-label">Foto da refeição <small>(opcional)</small></span>
      {preview ? (
        <div className="photo-preview">
          <img src={preview} alt="Prévia da refeição" />
          <button type="button" aria-label="Remover foto" onClick={onRemove}><X /></button>
        </div>
      ) : (
        <label className="photo-input">
          <input type="file" accept="image/*" capture="environment" onChange={onChoose} />
          <span><Camera /><b>Fotografar ou escolher foto</b><small>JPG, PNG ou HEIC</small></span>
          <ImagePlus aria-hidden="true" />
        </label>
      )}
    </div>
  )
}

export function MealForm() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { activeDiet } = useDiets()
  const requestRef = useRef<AbortController | null>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [form, setForm] = useState({ mealType: 'Café da manhã', description: '' })

  useEffect(() => () => {
    requestRef.current?.abort()
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
  }, [])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setPhoto(file)
    setPreview(file ? URL.createObjectURL(file) : '')
    setError('')
  }

  function removePhoto() {
    setPhoto(null)
    setPreview('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!activeDiet || !token) {
      setError('Selecione uma dieta antes de registrar uma refeição.')
      return
    }
    const description = form.description.trim()
    if (!description) {
      setError('Descreva a refeição.')
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    try {
      const photoUrl = photo && !isDemoMode ? await uploadPhoto(photo, controller.signal) : null
      const request: CreateMealRequest = {
        mealType: form.mealType,
        description,
        mealDate: localDateKey(),
        photoUrl,
      }
      if (!isDemoMode) {
        await api<Meal>(`/diets/${activeDiet.id}/meals`, { method: 'POST', token, body: JSON.stringify(request), signal: controller.signal })
      }
      if (controller.signal.aborted) return
      setSaved(true)
      redirectTimerRef.current = setTimeout(() => navigate('/historico'), 500)
    } catch (submitError) {
      if (!controller.signal.aborted) setError(getErrorMessage(submitError, 'Não foi possível salvar a refeição.'))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  if (!activeDiet) {
    return (
      <div className="page narrow-page">
        <PageTitle eyebrow="NOVO REGISTRO" title="Registrar refeição" />
        <EmptyState icon={<Camera />} title="Selecione uma dieta" text="É necessário ter uma dieta ativa antes de registrar refeições." />
        <Link className="button empty-action" to="/dietas">Ir para dietas</Link>
      </div>
    )
  }

  return (
    <div className="page narrow-page">
      <PageTitle eyebrow="NOVO REGISTRO" title="Registrar refeição" />
      <p className="page-lead">Registro em <strong>{activeDiet.name}</strong>. Uma foto ajuda a lembrar dos detalhes depois.</p>
      <form className="meal-form card" onSubmit={submit}>
        <label>
          Tipo de refeição
          <select value={form.mealType} onChange={(event) => setForm({ ...form, mealType: event.target.value })}>
            <option>Café da manhã</option><option>Lanche da manhã</option><option>Almoço</option>
            <option>Lanche da tarde</option><option>Jantar</option><option>Ceia</option>
          </select>
        </label>
        <label>
          Descrição
          <textarea required rows={5} placeholder="Descreva alimentos, porções e observações..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <PhotoField preview={preview} onChoose={choosePhoto} onRemove={removePhoto} />
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button loading={loading}>{saved ? <><Check /> Salvo</> : loading && photo ? 'Enviando...' : 'Salvar refeição'}</Button>
        </div>
      </form>
    </div>
  )
}
