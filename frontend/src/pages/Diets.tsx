import { Check, Plus, Salad, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { initialMembers } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { getErrorMessage } from '../lib/api'
import { parseLocalDate } from '../lib/date'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { CreateDietRequest, Diet, Member } from '../types'

const EMPTY_FORM: CreateDietRequest = { name: '', startDate: '', endDate: '' }
const NO_MEMBERS: Member[] = []

function formatDate(value: string) {
  return parseLocalDate(value).toLocaleDateString('pt-BR')
}

function DietCard({ diet, index, selected, canDelete, onSelect, onDelete }: { diet: Diet; index: number; selected: boolean; canDelete: boolean; onSelect: () => void; onDelete: () => void }) {
  return (
    <article className={`diet-card ${selected ? 'selected' : ''} ${index % 2 ? 'accent-green' : ''}`}>
      <div className="diet-card-top">
        <div className="diet-symbol"><Salad /></div>
        {selected && <span className="active-label"><Check /> Ativa</span>}
      </div>
      <h2>{diet.name}</h2>
      <p>Plano alimentar de {formatDate(diet.startDate)} a {formatDate(diet.endDate)}.</p>
      <div className="diet-meta two-items">
        <span><small>INÍCIO</small>{formatDate(diet.startDate)}</span>
        <span><small>FIM</small>{formatDate(diet.endDate)}</span>
      </div>
      <div className="diet-card-actions">
        {!selected && <Button className="outline" onClick={onSelect}>Selecionar dieta</Button>}
        {selected && canDelete && <Button className="danger" onClick={onDelete}><Trash2 size={17} /> Excluir dieta</Button>}
      </div>
    </article>
  )
}

function DeleteDietModal({ diet, onClose, onDelete }: { diet: Diet; onClose: () => void; onDelete: (id: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleting, onClose])

  async function confirmDelete() {
    setDeleting(true)
    setError('')
    try {
      await onDelete(diet.id)
      onClose()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Não foi possível excluir a dieta.'))
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleting && onClose()}>
      <div className="modal delete-diet-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-diet-title" aria-describedby="delete-diet-description">
        <button type="button" className="close" onClick={onClose} disabled={deleting} aria-label="Fechar"><X /></button>
        <Trash2 className="delete-diet-icon" aria-hidden="true" />
        <h2 id="delete-diet-title" ref={titleRef} tabIndex={-1}>Excluir {diet.name}</h2>
        <p id="delete-diet-description">Tem certeza que deseja excluir ?</p>
        <p className="delete-diet-warning">Todo o histórico dessa dieta será removido permanentemente.</p>
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="delete-diet-actions">
          <Button className="danger" loading={deleting} onClick={() => void confirmDelete()}>SIM</Button>
          <Button className="outline" disabled={deleting} onClick={onClose}>NÃO</Button>
        </div>
      </div>
    </div>
  )
}

function CreateDietModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: CreateDietRequest) => Promise<Diet> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<CreateDietRequest>(EMPTY_FORM)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const request = { ...form, name: form.name.trim() }
    if (!request.name) {
      setError('Informe um nome para a dieta.')
      return
    }
    setSaving(true)
    try {
      await onCreate(request)
      setSaving(false)
      onClose()
    } catch (createError) {
      setError(getErrorMessage(createError, 'Não foi possível criar a dieta.'))
      setSaving(false)
    }
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={closeFromBackdrop}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-diet-title">
        <button type="button" className="close" onClick={onClose} aria-label="Fechar"><X /></button>
        <span className="overline">NOVO PLANO</span>
        <h2 id="create-diet-title">Crie uma dieta</h2>
        <p>Defina o nome e o período para começar.</p>
        <form onSubmit={submit}>
          <label>
            Nome
            <input required autoFocus placeholder="Ex.: Rotina de primavera" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <div className="form-row">
            <label>Data inicial<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
            <label>Data final<input required min={form.startDate} type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
          <Button loading={saving}>Criar e selecionar</Button>
        </form>
      </div>
    </div>
  )
}

export function Diets() {
  const { user } = useAuth()
  const { diets, activeDiet, activeDietId, loading, error, selectDiet, createDiet, deleteDiet } = useDiets()
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível verificar sua permissão.')
  const [modalOpen, setModalOpen] = useState(false)
  const [dietToDelete, setDietToDelete] = useState<Diet | null>(null)
  const activeMembership = membersResource.data.find((member) => member.userId === user?.id)
  const canDeleteActiveDiet = activeMembership?.role === 'OWNER'

  return (
    <div className="page">
      <PageTitle eyebrow="PLANEJAMENTO" title="Suas dietas" action={<Button onClick={() => setModalOpen(true)}><Plus /> Nova dieta</Button>} />
      <p className="page-lead">Escolha uma rotina ativa ou crie um novo período alimentar.</p>
      {(error || membersResource.error) && <div className="error-message" role="alert">{error || membersResource.error}</div>}
      {loading ? <p className="loading-text">Carregando dietas...</p> : diets.length ? (
        <div className="diet-grid">
          {diets.map((diet, index) => <DietCard key={diet.id} diet={diet} index={index} selected={activeDietId === diet.id} canDelete={activeDiet?.id === diet.id && canDeleteActiveDiet} onSelect={() => selectDiet(diet.id)} onDelete={() => setDietToDelete(diet)} />)}
        </div>
      ) : <EmptyState icon={<Salad />} title="Nenhuma dieta criada" text="Crie uma dieta para definir seu período alimentar." />}
      {modalOpen && <CreateDietModal onClose={() => setModalOpen(false)} onCreate={createDiet} />}
      {dietToDelete && <DeleteDietModal diet={dietToDelete} onClose={() => setDietToDelete(null)} onDelete={deleteDiet} />}
    </div>
  )
}
