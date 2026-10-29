import { ArrowRight, Check, CheckCircle2, Info, ListChecks, Plus, Salad, Trash2, Utensils, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { initialMembers } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { getErrorMessage } from '../lib/api'
import { brazilDateKey, parseLocalDate } from '../lib/date'
import { DIET_MEAL_TYPES, dietMealTypesForDate, type DietMealType, type DietMealTypeScheduleEntry } from '../lib/dietMealTypes'
import { createUuid } from '../lib/uuid'
import { isDietPeriodEnded } from '../lib/dietPeriod'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { CreateDietRequest, Diet, Member } from '../types'

const EMPTY_FORM: CreateDietRequest = { name: '', startDate: '', endDate: '', competitiveMode: false, mealTypes: [...DIET_MEAL_TYPES] }
const NO_MEMBERS: Member[] = []

function formatDate(value: string) {
  return parseLocalDate(value).toLocaleDateString('pt-BR')
}

function DietCard({ diet, index, selected, canDelete, onSelect, onDelete, onEditMealTypes }: {
  diet: Diet
  index: number
  selected: boolean
  canDelete: boolean
  onSelect: () => void
  onDelete: () => void
  onEditMealTypes: () => void
}) {
  const completed = isDietPeriodEnded(diet.endDate)

  return (
    <article className={`diet-card ${selected ? 'selected' : ''} ${index % 2 ? 'accent-green' : ''}`}>
      <div className="diet-card-top">
        <div className="diet-symbol"><Salad /></div>
        <div className="diet-card-labels">
          {diet.competitiveMode && <span className="competitive-label">Competitiva</span>}
          {completed && <span className="completed-label"><CheckCircle2 aria-hidden="true" /> Concluída</span>}
          {selected && <span className="active-label"><Check /> Selecionada</span>}
        </div>
      </div>
      <h2>{diet.name}</h2>
      <p>Plano alimentar de {formatDate(diet.startDate)} a {formatDate(diet.endDate)}.</p>
      {completed && <p className="diet-completion-message" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true" /> Parabéns por concluir seu plano!</p>}
      <div className="diet-meta two-items">
        <span><small>INÍCIO</small>{formatDate(diet.startDate)}</span>
        <span><small>FIM</small>{formatDate(diet.endDate)}</span>
      </div>
      <div className="diet-card-actions">
        {!selected && <Button className="outline" onClick={onSelect}>Selecionar dieta</Button>}
        {diet.canManageMealTypes && <Button className="outline" onClick={onEditMealTypes}><ListChecks size={17} /> Refeições da dieta</Button>}
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

function CreateDietModal({ onClose, onCreate, onCreated }: { onClose: () => void; onCreate: (data: CreateDietRequest, operationId: string) => Promise<Diet>; onCreated: (diet: Diet) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<CreateDietRequest>(EMPTY_FORM)
  const [competitiveHelpOpen, setCompetitiveHelpOpen] = useState(false)
  const operationRef = useRef<{ fingerprint: string; id: string } | null>(null)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (competitiveHelpOpen) {
        setCompetitiveHelpOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [competitiveHelpOpen, onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const request = { ...form, name: form.name.trim() }
    if (!request.name) {
      setError('Informe um nome para a dieta.')
      return
    }
    if (!request.mealTypes.length) {
      setError('Selecione pelo menos uma refeição para esta dieta.')
      return
    }
    setSaving(true)
    try {
      const fingerprint = JSON.stringify(request)
      const operation = operationRef.current?.fingerprint === fingerprint
        ? operationRef.current
        : { fingerprint, id: createUuid() }
      operationRef.current = operation
      const createdDiet = await onCreate(request, operation.id)
      operationRef.current = null
      onCreated(createdDiet)
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
          <fieldset className="diet-meal-type-picker">
            <legend>Refeições desta dieta</legend>
            <p>Escolha quais refeições estarão disponíveis no grupo.</p>
            <div className="diet-meal-type-options">
              {DIET_MEAL_TYPES.map((mealType) => <label key={mealType}>
                <input
                  type="checkbox"
                  checked={form.mealTypes.includes(mealType)}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    mealTypes: event.target.checked
                      ? DIET_MEAL_TYPES.filter((type) => current.mealTypes.includes(type) || type === mealType)
                      : current.mealTypes.filter((type) => type !== mealType),
                  }))}
                />
                <span>{mealType}</span>
              </label>)}
            </div>
          </fieldset>
          <div className={`competitive-option${form.competitiveMode ? ' selected' : ''}`}>
            <label className="competitive-option-main">
              <input type="checkbox" checked={form.competitiveMode} onChange={(event) => setForm({ ...form, competitiveMode: event.target.checked })} />
              <span><strong>Modo competitivo</strong><small>Registre, pontue e suba no ranking.</small></span>
            </label>
            <button
              type="button"
              className="competitive-info"
              aria-label="Saiba mais sobre o modo competitivo"
              aria-expanded={competitiveHelpOpen}
              aria-controls="competitive-help"
              onClick={() => setCompetitiveHelpOpen((open) => !open)}
            >
              <Info size={17} aria-hidden="true" />
            </button>
            {competitiveHelpOpen && <p id="competitive-help" className="competitive-help" role="status">Registre refeições e água, ganhe pontos e suba no ranking. É a competição mais saudável desde a corrida até a geladeira.</p>}
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
          <Button loading={saving}>Criar e selecionar</Button>
        </form>
      </div>
    </div>
  )
}

function nextBrazilDate(today: string) {
  const next = new Date(`${today}T12:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

function MealTypesModal({ diet, onClose, onSave }: {
  diet: Diet
  onClose: () => void
  onSave: (dietId: string, mealTypes: DietMealType[]) => Promise<DietMealTypeScheduleEntry[]>
}) {
  const [schedule, setSchedule] = useState<DietMealTypeScheduleEntry[]>(() => diet.mealTypeSchedule ?? [])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const today = brazilDateKey()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const currentTypes = dietMealTypesForDate(schedule, today)
  const pending = schedule
    .filter((entry) => entry.effectiveFrom > today)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]
  const effectiveFrom = pending?.effectiveFrom ?? (today < diet.startDate ? diet.startDate : nextBrazilDate(today))
  const [selectedTypes, setSelectedTypes] = useState<DietMealType[]>(() => pending?.mealTypes ?? currentTypes)

  useEffect(() => {
    titleRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  function beginEditing() {
    setSelectedTypes(pending?.mealTypes ?? currentTypes)
    setError('')
    setEditing(true)
  }

  async function save() {
    if (!selectedTypes.length) {
      setError('Selecione pelo menos uma refeição para a dieta.')
      return
    }
    setSaving(true)
    setError('')
    try {
      setSchedule(await onSave(diet.id, selectedTypes))
      setEditing(false)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Não foi possível salvar as refeições da dieta.'))
    } finally {
      setSaving(false)
    }
  }

  function toggleMealType(mealType: DietMealType, checked: boolean) {
    setSelectedTypes((current) => checked
      ? DIET_MEAL_TYPES.filter((type) => current.includes(type) || type === mealType)
      : current.filter((type) => type !== mealType))
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <section className="modal diet-meal-types-modal" role="dialog" aria-modal="true" aria-labelledby="diet-meal-types-title">
      <button type="button" className="close" onClick={onClose} disabled={saving} aria-label="Fechar"><X /></button>
      <Utensils className="diet-meal-types-icon" aria-hidden="true" />
      <span className="overline">CONFIGURAÇÃO DA DIETA</span>
      <h2 id="diet-meal-types-title" ref={titleRef} tabIndex={-1}>Refeições de {diet.name}</h2>
      {editing ? <>
        <p>As alterações passam a valer em {parseLocalDate(effectiveFrom).toLocaleDateString('pt-BR')} e preservam os dias anteriores.</p>
        <fieldset className="diet-meal-type-picker">
          <legend>Selecione as refeições disponíveis</legend>
          <div className="diet-meal-type-options">
            {DIET_MEAL_TYPES.map((mealType) => <label key={mealType}>
              <input type="checkbox" checked={selectedTypes.includes(mealType)} onChange={(event) => toggleMealType(mealType, event.target.checked)} />
              <span>{mealType}</span>
            </label>)}
          </div>
        </fieldset>
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="diet-meal-types-actions">
          <Button type="button" loading={saving} onClick={() => void save()}>Salvar lista de refeições</Button>
          <Button type="button" className="outline" disabled={saving} onClick={() => { setEditing(false); setError('') }}>Cancelar</Button>
        </div>
      </> : <>
        <div className="diet-meal-types-summary">
          <strong>Em vigor hoje</strong>
          <div>{currentTypes.map((mealType) => <span key={mealType}>{mealType}</span>)}</div>
        </div>
        {pending && <p className="diet-meal-types-pending">Próxima configuração em {parseLocalDate(pending.effectiveFrom).toLocaleDateString('pt-BR')}: {pending.mealTypes.join(', ')}.</p>}
        <div className="diet-meal-types-actions">
          <Button type="button" onClick={beginEditing}><ListChecks aria-hidden="true" /> Editar lista de refeições</Button>
          <Button type="button" className="outline" onClick={onClose}>Fechar</Button>
        </div>
      </>}
    </section>
  </div>
}

export function Diets() {
  const { user } = useAuth()
  const { diets, activeDiet, activeDietId, loading, error, selectDiet, createDiet, updateDietMealTypes, deleteDiet } = useDiets()
  const navigate = useNavigate()
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível verificar sua permissão.')
  const [modalOpen, setModalOpen] = useState(false)
  const [dietToDelete, setDietToDelete] = useState<Diet | null>(null)
  const [dietToEditMealTypes, setDietToEditMealTypes] = useState<Diet | null>(null)
  const [createdDiet, setCreatedDiet] = useState<Diet | null>(null)
  const activeMembership = membersResource.data.find((member) => member.userId === user?.id)
  const canDeleteActiveDiet = activeMembership?.role === 'OWNER'

  function continueWithFirstMeal() {
    if (!createdDiet) return
    selectDiet(createdDiet.id)
    navigate('/refeicoes/nova')
  }

  return (
    <div className="page">
      <PageTitle eyebrow="PLANEJAMENTO" title="Suas dietas" action={<Button onClick={() => { setCreatedDiet(null); setModalOpen(true) }}><Plus /> Nova dieta</Button>} />
      <p className="page-lead">Escolha uma rotina ativa ou crie um novo período alimentar.</p>
      {createdDiet && <section className="diet-created-next-step" aria-labelledby="diet-created-title">
        <div role="status">
          <span className="overline">DIETA CRIADA</span>
          <h2 id="diet-created-title">Tudo pronto para começar.</h2>
          <p>Registre sua primeira refeição em {createdDiet.name}.</p>
        </div>
        <Button type="button" onClick={continueWithFirstMeal}>Registrar primeira refeição <ArrowRight size={18} /></Button>
      </section>}
      {(error || membersResource.error) && <div className="error-message" role="alert">{error || membersResource.error}</div>}
      {loading ? <p className="loading-text">Carregando dietas...</p> : diets.length ? (
        <div className="diet-grid">
          {diets.map((diet, index) => <DietCard key={diet.id} diet={diet} index={index} selected={activeDietId === diet.id} canDelete={activeDiet?.id === diet.id && canDeleteActiveDiet} onSelect={() => { selectDiet(diet.id); setCreatedDiet(null) }} onDelete={() => setDietToDelete(diet)} onEditMealTypes={() => setDietToEditMealTypes(diet)} />)}
        </div>
      ) : <EmptyState icon={<Salad />} title="Nenhuma dieta criada" text="Crie uma dieta para definir seu período alimentar." />}
      {modalOpen && <CreateDietModal onClose={() => setModalOpen(false)} onCreate={createDiet} onCreated={setCreatedDiet} />}
      {dietToEditMealTypes && <MealTypesModal diet={dietToEditMealTypes} onClose={() => setDietToEditMealTypes(null)} onSave={updateDietMealTypes} />}
      {dietToDelete && <DeleteDietModal diet={dietToDelete} onClose={() => setDietToDelete(null)} onDelete={deleteDiet} />}
    </div>
  )
}
