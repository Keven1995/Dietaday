import { AlertTriangle, RefreshCw, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageTitle } from '../components/Ui'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { parseLocalDate } from '../lib/date'
import { useDiets } from '../state/DietContext'
import type { RankingParticipant } from '../types'

function date(value: string | null) {
  return value ? parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : 'Ainda não fechado'
}

function initials(name: string) { return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('') }

function Podium({ participants }: { participants: RankingParticipant[] }) {
  if (!participants.length) return null
  return <div className="ranking-podium">{participants.slice(0, 3).map((participant) => <div className={`podium-place podium-place-${participant.position}`} key={participant.userId}><i>{participant.position}</i><strong>{participant.displayName}</strong><span>{participant.officialPoints} pts</span></div>)}</div>
}

export function Ranking() {
  const { activeDiet } = useDiets()
  const [page, setPage] = useState(0)
  const { ranking, details, loading, error, reload } = useCompetitiveRanking(page)
  if (!activeDiet || !activeDiet.competitiveMode) return <div className="page ranking-page"><EmptyState icon={<Trophy />} title="Ranking competitivo" text="Selecione uma dieta competitiva para acompanhar sua posição." /><Link className="button empty-action" to="/dietas">Ver dietas</Link></div>

  return <div className="page ranking-page">
    <PageTitle eyebrow="MODO COMPETITIVO" title="Ranking" action={<button className="button outline ranking-refresh" onClick={reload} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar</button>} />
    <p className="page-lead">Pontuação atualizada em tempo real na dieta <strong>{activeDiet.name}</strong>. O fechamento diário apenas consolida os pontos.</p>
    {error && <div className="error-message ranking-error" role="alert"><AlertTriangle size={17} />{error}</div>}
    {loading && !ranking && <div className="ranking-loading"><span /><span /><span /></div>}
    {ranking && <>
      <section className="ranking-hero card"><div className="ranking-hero-icon"><Trophy size={25} /></div><div><span>POSIÇÃO OFICIAL</span><strong>{ranking.currentUser.position}º lugar</strong><small>{ranking.currentUser.officialPoints} pontos acumulados</small></div><div className="ranking-pending"><b>+{ranking.currentUser.pendingPoints}</b><span>pendentes</span></div></section>
      <div className="ranking-meta-row"><span><b>{ranking.status === 'FINALIZED' ? 'FINALIZADO' : 'ATIVO'}</b> · {date(ranking.startDate)} a {date(ranking.endDate)}</span><span>Último fechamento: {date(ranking.lastClosedDate)}</span></div>
      {ranking.status === 'FINALIZED' && <div className="ranking-final-note">Este ranking está congelado e representa o resultado final.</div>}
      <Podium participants={ranking.participants} />
      <section className="ranking-table-card card"><div className="section-heading"><div><span>CLASSIFICAÇÃO</span><h2>Participantes</h2></div><small>{ranking.page.totalElements} pessoas</small></div><div className="ranking-list">{ranking.participants.map((participant) => <div className={participant.userId === ranking.currentUser.userId ? 'ranking-row is-current' : 'ranking-row'} key={participant.userId}><b className="ranking-position">{participant.position}</b><i className="ranking-avatar">{initials(participant.displayName)}</i><div><strong>{participant.displayName}</strong>{participant.userId === ranking.currentUser.userId && <small>Você</small>}</div><span><strong>{participant.officialPoints}</strong><small>{participant.activeDays} dias ativos</small></span></div>)}{!ranking.participants.length && <p className="muted-text">Nenhum participante encontrado.</p>}</div>{ranking.page.totalPages > 1 && <div className="ranking-pagination"><button onClick={() => setPage((current) => current - 1)} disabled={page === 0} aria-label="Página anterior">‹</button><span>Página {page + 1} de {ranking.page.totalPages}</span><button onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= ranking.page.totalPages} aria-label="Próxima página">›</button></div>}</section>
      {details && <section className="ranking-detail-card card"><div className="section-heading"><div><span>SEUS PONTOS</span><h2>O que está pendente</h2></div></div><p>{details.pendingPoints ? `Você tem ${details.pendingPoints} pontos aguardando o próximo fechamento.` : 'Nenhum ponto pendente por enquanto.'}</p></section>}
    </>}
  </div>
}
