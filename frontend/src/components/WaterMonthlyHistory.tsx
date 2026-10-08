import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Ui'
import { getErrorMessage } from '../lib/api'
import { brazilDateKey } from '../lib/date'
import { getWaterHistory, readCachedWaterHistory } from '../lib/water'
import {
  shiftWaterHistoryMonth,
  waterCalendarCells,
  waterHistoryDateLabel,
  waterHistoryDayStatus,
  waterHistoryDayStatusLabel,
  waterHistoryMonthLabel,
  type WaterHistoryDayStatus,
} from '../lib/waterHistoryCalendar'
import type { WaterHistoryDay } from '../types'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function formatLiters(amountMl: number) {
  return `${amountMl / 1000}`.replace('.', ',') + ' L'
}

function statusMarker(status: WaterHistoryDayStatus) {
  switch (status) {
    case 'FUTURE': return '·'
    case 'NO_RECORDS': return '—'
    case 'GOAL_UNAVAILABLE': return '?'
    case 'GOAL_REACHED': return '✓'
    case 'BELOW_GOAL': return '•'
  }
}

export function WaterMonthlyHistory({
  userId,
  token,
  dietId,
}: {
  userId: string | null
  token: string | null
  dietId: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [month, setMonth] = useState(() => brazilDateKey().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState<string | null>(() => brazilDateKey())
  const [data, setData] = useState<{ month: string; days: WaterHistoryDay[] } | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const lastRetryKey = useRef(0)

  const cacheKey = `${userId ?? 'anonymous'}:${dietId ?? 'general'}:${month}`
  const visibleData = loadedKey === cacheKey ? data : null
  const monthLabel = waterHistoryMonthLabel(month)
  const today = brazilDateKey()
  const dayMap = useMemo(() => new Map(visibleData?.days.map((day) => [day.date, day]) ?? []), [visibleData])
  const registeredDays = visibleData?.days.filter((day) => day.hasRecords).length
  const summary = registeredDays === undefined
    ? 'Ver histórico mensal'
    : `${registeredDays} ${registeredDays === 1 ? 'dia registrado' : 'dias registrados'} neste mês`

  useEffect(() => {
    if (!expanded || !userId) return
    let active = true
    const retryRequested = retryKey !== lastRetryKey.current
    lastRetryKey.current = retryKey
    const cached = readCachedWaterHistory(userId, month, dietId)

    setError('')
    setData(cached?.data ?? null)
    setLoadedKey(cached ? cacheKey : '')
    setLoading(Boolean(!cached?.fresh || retryRequested))
    if (cached?.fresh && !retryRequested) {
      setLoading(false)
      return () => { active = false }
    }

    void getWaterHistory(token, userId, month, dietId)
      .then((history) => {
        if (!active) return
        setData(history)
        setLoadedKey(cacheKey)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(getErrorMessage(loadError, 'Não foi possível carregar o histórico de hidratação.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [cacheKey, dietId, expanded, month, retryKey, token, userId])

  function changeMonth(offset: number) {
    setMonth((current) => shiftWaterHistoryMonth(current, offset))
    setSelectedDate(null)
  }

  const selectedDay = selectedDate ? dayMap.get(selectedDate) : undefined
  const selectedStatus = selectedDate ? waterHistoryDayStatus(selectedDate, today, selectedDay) : null
  const statusLegend: Array<{ status: WaterHistoryDayStatus; label: string }> = [
    { status: 'GOAL_REACHED', label: 'Meta atingida' },
    { status: 'BELOW_GOAL', label: 'Abaixo da meta' },
    { status: 'GOAL_UNAVAILABLE', label: 'Meta histórica indisponível' },
    { status: 'NO_RECORDS', label: 'Sem registros' },
    { status: 'FUTURE', label: 'Futuro' },
  ]

  return (
    <section className="card water-monthly-history-card">
      <button
        type="button"
        className="water-monthly-history-toggle"
        aria-expanded={expanded}
        aria-controls="water-monthly-history-panel"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="water-monthly-history-heading">
          <span>HISTÓRICO</span>
          <strong>Histórico de hidratação</strong>
          <small>{summary}</small>
        </span>
        <span className="water-monthly-history-cta">
          {expanded ? 'Ocultar histórico' : 'Ver histórico mensal'}
          <ChevronDown size={18} aria-hidden="true" />
        </span>
      </button>

      <div id="water-monthly-history-panel" hidden={!expanded}>
        {expanded && (
          <div className="water-monthly-history-content">
            <div className="water-history-month-nav">
              <button type="button" aria-label="Mês anterior" onClick={() => changeMonth(-1)}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <h3 aria-live="polite">{monthLabel}</h3>
              <button type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="water-history-calendar-scroll">
              <div className="water-history-calendar" role="group" aria-label={`Dias de ${monthLabel}`}>
                {WEEKDAYS.map((weekday) => <span className="water-history-weekday" key={weekday} aria-hidden="true">{weekday}</span>)}
                {waterCalendarCells(month).map((cell, index) => {
                  if (!cell) return <span className="water-history-calendar-empty" key={`empty-${index}`} aria-hidden="true" />
                  const day = dayMap.get(cell.date)
                  const status = waterHistoryDayStatus(cell.date, today, day)
                  const selected = selectedDate === cell.date
                  return (
                    <button
                      type="button"
                      key={cell.date}
                      className={`water-history-day status-${status.toLowerCase().replaceAll('_', '-')}${selected ? ' selected' : ''}`}
                      aria-label={`${waterHistoryDateLabel(cell.date)} — ${waterHistoryDayStatusLabel(status)}`}
                      aria-pressed={selected}
                      disabled={status === 'FUTURE'}
                      onClick={() => setSelectedDate(cell.date)}
                    >
                      <span>{cell.dayNumber}</span>
                      <small aria-hidden="true">{statusMarker(status)}</small>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="water-history-legend" aria-label="Legenda do calendário">
              {statusLegend.map(({ status, label }) => (
                <span key={status} className={`status-${status.toLowerCase().replaceAll('_', '-')}`}>
                  <i aria-hidden="true">{statusMarker(status)}</i>{label}
                </span>
              ))}
            </div>

            {loading && !visibleData && (
              <div className="water-history-loading" role="status" aria-label="Carregando histórico mensal">
                <span /><span /><span />
              </div>
            )}
            {loading && visibleData && <p className="water-history-updating" role="status">Atualizando histórico salvo…</p>}
            {error && visibleData && (
              <div className="water-history-cache-message" role="status">
                <p>Não foi possível atualizar. Mostrando os dados salvos neste dispositivo.</p>
                <Button type="button" className="outline" onClick={() => setRetryKey((key) => key + 1)}>
                  <RotateCcw size={16} /> Tentar novamente
                </Button>
              </div>
            )}
            {error && !visibleData && (
              <div className="water-history-error" role="alert">
                <p>{error}</p>
                <Button type="button" className="outline" onClick={() => setRetryKey((key) => key + 1)}>
                  <RotateCcw size={16} /> Tentar novamente
                </Button>
              </div>
            )}
            {!loading && visibleData?.days.length === 0 && (
              <p className="water-history-empty">Nenhum registro salvo neste mês.</p>
            )}

            <section className="water-history-day-detail" aria-live="polite" aria-labelledby="water-history-day-title">
              <h3 id="water-history-day-title">Detalhes do dia</h3>
              {!selectedDate && <p>Selecione um dia do calendário para ver os detalhes.</p>}
              {selectedDate && selectedStatus === 'FUTURE' && <p>Essa data ainda não aconteceu.</p>}
              {selectedDate && visibleData && selectedStatus === 'NO_RECORDS' && <p>Sem registros para {waterHistoryDateLabel(selectedDate)}.</p>}
              {selectedDate && selectedDay?.hasRecords && selectedStatus === 'GOAL_UNAVAILABLE' && (
                <div>
                  <p>{formatLiters(selectedDay.consumedMl)} consumidos em {waterHistoryDateLabel(selectedDate)}.</p>
                  <p className="water-history-unknown-goal">Meta histórica indisponível; percentual não calculado.</p>
                </div>
              )}
              {selectedDate && selectedDay?.hasRecords && selectedDay.goalMl !== null && selectedDay.percentage !== null && (
                <div className="water-history-day-progress">
                  <p>{formatLiters(selectedDay.consumedMl)} de {formatLiters(selectedDay.goalMl)}</p>
                  <strong>{selectedDay.percentage}% da meta do dia</strong>
                  <div
                    className="water-history-progress"
                    role="progressbar"
                    aria-label={`Progresso da hidratação em ${waterHistoryDateLabel(selectedDate)}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={selectedDay.percentage}
                  >
                    <span style={{ width: `${selectedDay.percentage}%` }} />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
