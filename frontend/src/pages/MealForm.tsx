import { Camera, Check, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { getErrorMessage, isDemoMode } from '../lib/api'
import { compressPhoto, isPhotoUploadConfigured } from '../lib/cloudinary'
import { localDateKey } from '../lib/date'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import { useOfflineMeals } from '../state/OfflineMealContext'

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
  const location = useLocation()
  const { token } = useAuth()
  const { activeDiet } = useDiets()
  const { enqueue, operations } = useOfflineMeals()
  const editId = (location.state as { offlineOperationId?: string } | null)?.offlineOperationId
  const editedOperation = operations.find((operation) => operation.id === editId)
  const initializedEditRef = useRef<string | null>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoChanged, setPhotoChanged] = useState(false)
  const [form, setForm] = useState({ mealType: 'Café da manhã', description: '' })

  useEffect(() => () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
  }, [])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => {
    if (!editedOperation || initializedEditRef.current === editedOperation.id) return
    initializedEditRef.current = editedOperation.id
    setForm({ mealType: editedOperation.request.mealType, description: editedOperation.request.description })
    if (editedOperation.photo) {
      const file = new File([editedOperation.photo], editedOperation.photoName ?? 'refeicao.jpg', { type: editedOperation.photo.type })
      setPhoto(file)
      setPreview(URL.createObjectURL(file))
    }
  }, [editedOperation])

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setPhoto(file)
    setPhotoChanged(true)
    setPreview(file ? URL.createObjectURL(file) : '')
    setError('')
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoChanged(true)
    setPreview('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if ((!activeDiet && !editedOperation) || !token) {
      setError('Selecione uma dieta antes de registrar uma refeição.')
      return
    }
    const description = form.description.trim()
    if (!description) {
      setError('Descreva a refeição.')
      return
    }

    setLoading(true)
    try {
      if (photo && !isDemoMode && !isPhotoUploadConfigured) {
        throw new Error('O upload de fotos não está configurado. Remova a foto ou configure o Cloudinary.')
      }
      const storedPhoto = photo && !isDemoMode ? await compressPhoto(photo) : photo
      if (!isDemoMode) await enqueue({
        operationId: editedOperation?.id,
        dietId: editedOperation?.dietId ?? activeDiet!.id,
        dietName: editedOperation?.dietName ?? activeDiet!.name,
        request: {
          mealType: form.mealType,
          description,
          mealDate: editedOperation?.request.mealDate ?? localDateKey(),
        },
        photo: editedOperation && !photoChanged ? undefined : storedPhoto,
      })
      setSaved(true)
      redirectTimerRef.current = setTimeout(() => navigate('/historico'), 500)
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Não foi possível salvar a refeição neste dispositivo.'))
    } finally {
      setLoading(false)
    }
  }

  if (!activeDiet && !editedOperation) {
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
      <PageTitle eyebrow={editedOperation ? 'CORRIGIR REGISTRO' : 'NOVO REGISTRO'} title={editedOperation ? 'Editar refeição pendente' : 'Registrar refeição'} />
      <p className="page-lead">Registro em <strong>{editedOperation?.dietName ?? activeDiet!.name}</strong>. A refeição será salva neste dispositivo e sincronizada quando houver conexão.</p>
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
          <Button loading={loading}>{saved ? <><Check /> Salvo</> : loading && photo ? 'Preparando foto...' : editedOperation ? 'Salvar correção' : 'Salvar refeição'}</Button>
        </div>
      </form>
    </div>
  )
}
