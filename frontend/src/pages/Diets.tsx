import { Check, Plus, Salad, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { getErrorMessage } from '../lib/api'
import { parseLocalDate } from '../lib/date'
import { useDiets } from '../state/DietContext'
import type { CreateDietRequest, Diet } from '../types'

const EMPTY_FORM: CreateDietRequest = { name: '', startDate: '', endDate: '' }

function formatDate(value: string) {
  return parseLocalDate(value).toLocaleDateString('pt-BR')
}

function DietCard({ diet, index, selected, onSelect }: { diet: Diet; index: number; selected: boolean; onSelect: () => void }) {
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
      {!selected && <Button className="outline" onClick={onSelect}>Selecionar dieta</Button>}
    </article>
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
  const { diets, activeDietId, loading, error, selectDiet, createDiet } = useDiets()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="page">
      <PageTitle eyebrow="PLANEJAMENTO" title="Suas dietas" action={<Button onClick={() => setModalOpen(true)}><Plus /> Nova dieta</Button>} />
      <p className="page-lead">Escolha uma rotina ativa ou crie um novo período alimentar.</p>
      {error && <div className="error-message" role="alert">{error}</div>}
      {loading ? <p className="loading-text">Carregando dietas...</p> : diets.length ? (
        <div className="diet-grid">
          {diets.map((diet, index) => <DietCard key={diet.id} diet={diet} index={index} selected={activeDietId === diet.id} onSelect={() => selectDiet(diet.id)} />)}
        </div>
      ) : <EmptyState icon={<Salad />} title="Nenhuma dieta criada" text="Crie uma dieta para definir seu período alimentar." />}
      {modalOpen && <CreateDietModal onClose={() => setModalOpen(false)} onCreate={createDiet} />}
    </div>
  )
}
