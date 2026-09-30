import { Camera, Check, ImagePlus, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatedCheck, type AnimatedCheckStatus } from '../components/motion/AnimatedCheck'
import { AnimatedError } from '../components/motion/AnimatedError'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { getErrorMessage, isDemoMode } from '../lib/api'
import { compressPhoto, isPhotoUploadConfigured, validatePhoto } from '../lib/cloudinary'
import { localDateKey } from '../lib/date'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import { MEAL_SYNCED_EVENT, MEAL_SYNC_PROGRESS_EVENT, useOfflineMeals, type MealSyncProgressDetail } from '../state/OfflineMealContext'
import { useToast } from '../state/ToastContext'

function PhotoField({ preview, onChoose, onRemove, uploadProgress }: { preview: string; onChoose: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; uploadProgress: number | null }) {
  const uploading = uploadProgress !== null && uploadProgress < 100
  return (
    <div>
      <span className="field-label">Foto da refeição <small>(opcional)</small></span>
      {preview ? (
        <div className="photo-preview">
          <img className={uploading ? 'is-uploading' : undefined} src={preview} alt="Prévia da refeição" />
          {uploading && <span className="photo-upload-progress" role="status">Enviando foto: {uploadProgress}%</span>}
          <button type="button" aria-label="Remover foto" disabled={uploading} onClick={onRemove}><X /></button>
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
  const { showToast } = useToast()
  const notify = useEffectEvent(showToast)
  const editId = (location.state as { offlineOperationId?: string } | null)?.offlineOperationId
  const editedOperation = operations.find((operation) => operation.id === editId)
  const initializedEditRef = useRef<string | null>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedAtRef = useRef(0)
  const notifiedFailureRef = useRef('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveStatus, setSaveStatus] = useState<AnimatedCheckStatus>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [submittedOperationId, setSubmittedOperationId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
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
    const handleProgress = (event: Event) => {
      const detail = (event as CustomEvent<MealSyncProgressDetail>).detail
      if (!detail || detail.operationId !== submittedOperationId) return
      if (detail.phase === 'cloudinary-upload') setUploadProgress(detail.progress ?? 0)
      if (detail.phase === 'cloudinary-uploaded') setUploadProgress(100)
    }
    const handleSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ operationId?: string }>).detail
      if (!detail?.operationId || detail.operationId !== submittedOperationId) return
      setUploadProgress(null)
      setSaved(true)
      setSaveStatus('success')
      setSaveMessage('Refeição registrada e sincronizada com sucesso.')
      notify({ message: 'Refeição sincronizada com sucesso.', tone: 'success' })
      redirectTimerRef.current = setTimeout(() => navigate('/historico'), 700)
    }
    window.addEventListener(MEAL_SYNC_PROGRESS_EVENT, handleProgress)
    window.addEventListener(MEAL_SYNCED_EVENT, handleSynced)
    return () => {
      window.removeEventListener(MEAL_SYNC_PROGRESS_EVENT, handleProgress)
      window.removeEventListener(MEAL_SYNCED_EVENT, handleSynced)
    }
  }, [navigate, submittedOperationId])

  useEffect(() => {
    if (!submittedOperationId) return
    const operation = operations.find((item) => item.id === submittedOperationId)
    if (operation?.status !== 'failed' || Date.parse(operation.lastFailureAt ?? '') < submittedAtRef.current) return
    setUploadProgress(null)
    setSaved(true)
    setSaveStatus('error')
    setSaveMessage(operation.error ?? 'Não foi possível sincronizar a refeição. Tente novamente.')
    const failureKey = `${operation.id}:${operation.lastFailureAt ?? operation.attempts}`
    if (notifiedFailureRef.current !== failureKey) {
      notifiedFailureRef.current = failureKey
      notify({ message: operation.error ?? 'Não foi possível sincronizar a refeição.', tone: 'error' })
    }
  }, [operations, submittedOperationId])

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
    if (file) {
      try {
        validatePhoto(file)
      } catch (photoError) {
        setPhoto(null)
        setPhotoChanged(false)
        setUploadProgress(null)
        setPreview('')
        setError(photoError instanceof Error ? photoError.message : 'A foto selecionada não é válida.')
        event.target.value = ''
        return
      }
    }
    setPhoto(file)
    setPhotoChanged(true)
    setUploadProgress(null)
    setPreview(file ? URL.createObjectURL(file) : '')
    setError('')
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoChanged(true)
    setUploadProgress(null)
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
    setSaved(false)
    setSaveMessage('')
    setSubmittedOperationId(null)
    setUploadProgress(null)
    setSaveStatus('loading')
    try {
      if (photo && !isDemoMode && !isPhotoUploadConfigured) {
        throw new Error('O upload de fotos não está configurado. Remova a foto ou configure o Cloudinary.')
      }
      const storedPhoto = photo && !isDemoMode ? await compressPhoto(photo) : photo
      if (isDemoMode) {
        setSaved(true)
        setSaveStatus('success')
        setSaveMessage('Refeição registrada com sucesso.')
        notify({ message: 'Refeição registrada com sucesso.', tone: 'success' })
        redirectTimerRef.current = setTimeout(() => navigate('/historico'), 500)
      } else {
        const operationId = await enqueue({
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
        submittedAtRef.current = Date.now()
        setSubmittedOperationId(operationId)
        setSaved(true)
        setSaveStatus('loading')
        setSaveMessage('Refeição salva neste dispositivo. Aguardando sincronização...')
      }
    } catch (submitError) {
      setSaveStatus('error')
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
        <PhotoField preview={preview} onChoose={choosePhoto} onRemove={removePhoto} uploadProgress={uploadProgress} />
        {error && <AnimatedError>{error}</AnimatedError>}
        {saved && <AnimatedCheck status={saveStatus} label={saveMessage} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button loading={loading || (submittedOperationId !== null && saveStatus === 'loading')} success={saveStatus === 'success'}>{saveStatus === 'success' ? <><Check /> Sincronizada</> : loading && photo ? 'Preparando foto...' : submittedOperationId && saveStatus === 'loading' ? 'Aguardando sincronização...' : editedOperation ? 'Salvar correção' : 'Salvar refeição'}</Button>
        </div>
      </form>
    </div>
  )
}
