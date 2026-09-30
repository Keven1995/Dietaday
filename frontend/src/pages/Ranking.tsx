import { RefreshCw, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedCounter } from '../components/motion/AnimatedCounter'
import { AnimatedError } from '../components/motion/AnimatedError'
import { RankingMovement } from '../components/motion/RankingMovement'
import { SkeletonList } from '../components/motion/SkeletonCard'
import { EmptyState, PageTitle } from '../components/Ui'
import { MOTION_DURATION, MOTION_STAGGER } from '../constants/motion'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import { parseLocalDate } from '../lib/date'
import { getRankingMovement, type RankingMovementDirection } from '../lib/rankingMovement'
import { createUxEventId, reportUxEvent } from '../lib/uxTelemetry'
import { useCelebration } from '../state/CelebrationContext'
import { useAuth } from '../state/AuthContext'
import type { RankingParticipant } from '../types'

function date(value: string | null) {
  return value ? parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : 'Ainda não fechado'
}

function initials(name: string) { return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('') }

function Podium({ participants, podium, reducedMotion }: { participants: RankingParticipant[]; podium: { first: string | null; second: string | null; third: string | null }; reducedMotion: boolean }) {
  const participantsById = new Map(participants.map((participant) => [participant.userId, participant]))
  const podiumParticipants = [podium.second, podium.first, podium.third]
    .map((userId) => userId ? participantsById.get(userId) : undefined)
    .filter((participant): participant is RankingParticipant => Boolean(participant))
  if (!podiumParticipants.length) return null
  return <div className="ranking-podium">{podiumParticipants.map((participant, index) => <motion.div
    className={`podium-place podium-place-${participant.position}${participant.position === 1 ? ' is-winner' : ''}`}
    key={participant.userId}
    layout={!reducedMotion ? 'position' : false}
    initial={reducedMotion ? false : { opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={reducedMotion ? undefined : { y: -4 }}
    transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000, delay: reducedMotion ? 0 : index * MOTION_STAGGER.normal, ease: 'easeOut' }}
  ><i>{participant.position}</i><strong>{participant.displayName}</strong><span><AnimatedCounter value={participant.officialPoints} suffix=" pts" /></span></motion.div>)}</div>
}

export function Ranking() {
  const { activeDiet, enabled } = useCompetitiveMode()
  const [page, setPage] = useState(0)
  const [movement, setMovement] = useState<{ direction: RankingMovementDirection; position: number } | null>(null)
  const previousPosition = useRef<{ dietId: string; position: number } | null>(null)
  const reducedMotion = useReducedMotionPreference()
  const { ranking, details, loading, error, reload } = useCompetitiveRanking(page)
  const { celebrate } = useCelebration()
  const { token } = useAuth()
  const celebrateFinal = useEffectEvent(celebrate)

  useEffect(() => {
    if (!ranking || !activeDiet || ranking.dietId !== activeDiet.id) return
    const previous = previousPosition.current
    const direction = previous?.dietId === activeDiet.id
      ? getRankingMovement(previous.position, ranking.currentUser.position)
      : null
    setMovement(direction ? { direction, position: ranking.currentUser.position } : null)
    if (direction) {
      void reportUxEvent(token, {
        eventName: 'ranking_position_changed',
        eventId: createUxEventId(`ranking:${activeDiet.id}`),
        dietId: activeDiet.id,
        details: { direction, position: ranking.currentUser.position },
      })
    }
    previousPosition.current = { dietId: activeDiet.id, position: ranking.currentUser.position }
  }, [activeDiet?.id, ranking?.currentUser.position, ranking?.dietId, token])

  useEffect(() => {
    if (!ranking || ranking.status !== 'FINALIZED' || !ranking.podium) return
    celebrateFinal({ type: 'RANKING_FINALIZED', id: `${ranking.dietId}:${ranking.endDate}` })
  }, [ranking?.dietId, ranking?.endDate, ranking?.podium?.first, ranking?.podium?.second, ranking?.podium?.third, ranking?.status])

  if (!activeDiet || !enabled) return <div className="page ranking-page"><EmptyState icon={<Trophy />} title="Ranking competitivo" text="Selecione uma dieta competitiva para acompanhar sua posição." /><Link className="button empty-action" to="/dietas">Ver dietas</Link></div>

  return <div className="page ranking-page">
    <PageTitle eyebrow="MODO COMPETITIVO" title="Ranking" action={<button className="button outline ranking-refresh" onClick={reload} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar</button>} />
    <p className="page-lead">Pontuação atualizada em tempo real na dieta <strong>{activeDiet.name}</strong>. O fechamento diário apenas consolida os pontos.</p>
     {error && <AnimatedError className="ranking-error">{error}</AnimatedError>}
     {loading && !ranking && <SkeletonList count={3} className="ranking-loading" />}
       {ranking && <>
        <section className="ranking-hero card"><div className="ranking-hero-icon"><Trophy size={25} /></div><div><span>POSIÇÃO OFICIAL</span><strong>{ranking.currentUser.position}º lugar</strong><small><AnimatedCounter value={ranking.currentUser.officialPoints} suffix=" pontos acumulados" /></small></div><div className="ranking-pending"><b><AnimatedCounter value={ranking.currentUser.pendingPoints} prefix="+" /></b><span>pendentes</span></div></section>
       <RankingMovement direction={movement?.direction ?? null} position={movement?.position ?? ranking.currentUser.position} onComplete={() => setMovement(null)} />
      <div className="ranking-meta-row"><span><b>{ranking.status === 'FINALIZED' ? 'FINALIZADO' : 'ATIVO'}</b> · {date(ranking.startDate)} a {date(ranking.endDate)}</span><span>Último fechamento: {date(ranking.lastClosedDate)}</span></div>
      {ranking.status === 'FINALIZED' && <div className="ranking-final-note">Este ranking está congelado e representa o resultado final.</div>}
        {ranking.status === 'FINALIZED' && ranking.podium && <Podium participants={ranking.participants} podium={ranking.podium} reducedMotion={reducedMotion} />}
       <section className="ranking-table-card card"><div className="section-heading"><div><span>CLASSIFICAÇÃO</span><h2>Participantes</h2></div><small>{ranking.page.totalElements} pessoas</small></div><div className="ranking-list">{ranking.participants.map((participant) => <motion.div layout={!reducedMotion ? 'position' : false} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }} className={participant.userId === ranking.currentUser.userId ? 'ranking-row is-current' : 'ranking-row'} key={participant.userId}><b className="ranking-position">{participant.position}</b><i className="ranking-avatar">{initials(participant.displayName)}</i><div><strong>{participant.displayName}</strong>{participant.userId === ranking.currentUser.userId && <small>Você</small>}</div><span><strong><AnimatedCounter value={participant.officialPoints} /></strong><small>{participant.activeDays} dias ativos</small></span></motion.div>)}{!ranking.participants.length && <p className="muted-text">Nenhum participante encontrado.</p>}</div>{ranking.page.totalPages > 1 && <div className="ranking-pagination"><button onClick={() => setPage((current) => current - 1)} disabled={page === 0} aria-label="Página anterior">‹</button><span>Página {page + 1} de {ranking.page.totalPages}</span><button onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= ranking.page.totalPages} aria-label="Próxima página">›</button></div>}</section>
      {details && <section className="ranking-detail-card card"><div className="section-heading"><div><span>SEUS PONTOS</span><h2>O que está pendente</h2></div></div><p>{details.pendingPoints ? `Você tem ${details.pendingPoints} pontos aguardando o próximo fechamento.` : 'Nenhum ponto pendente por enquanto.'}</p></section>}
    </>}
  </div>
}
