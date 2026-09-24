import { CalendarDays, Droplets, Home, Salad, Trophy, UserRound, Users } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { InvitationNotifications } from './InvitationNotifications'
import { CreatorCredit } from './CreatorCredit'
import { ServerConnectionNotice } from './ServerConnectionNotice'
import { OfflineMealNotice } from './OfflineMealNotice'
import { CompetitiveRankingWidget } from './CompetitiveRankingWidget'
import { useDiets } from '../state/DietContext'

const nav = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/dietas', label: 'Dietas', icon: Salad },
  { to: '/historico', label: 'Histórico', icon: CalendarDays },
  { to: '/membros', label: 'Membros', icon: Users },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
  { to: '/agua', label: 'Água', icon: Droplets },
]

function NavigationLinks({ competitive }: { competitive: boolean }) {
  const links = competitive ? [...nav, { to: '/ranking', label: 'Ranking', icon: Trophy }] : nav
  return links.map(({ to, label, icon: Icon }) => (
    <NavLink key={to} to={to} end={to === '/'}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  ))
}

export function Layout() {
  const { user } = useAuth()
  const { activeDiet } = useDiets()
  const location = useLocation()
  const competitive = Boolean(activeDiet?.competitiveMode)
  const title = (competitive ? [...nav, { to: '/ranking', label: 'Ranking', icon: Trophy }] : nav).find((item) => item.to === location.pathname)?.label ?? 'Dietaday'

  return (
    <div className="app-shell">
      <ServerConnectionNotice />
      <div className="layout-notifications"><InvitationNotifications /></div>
      <aside className="side-nav">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Dietaday</span>
        </div>
        <nav aria-label="Navegação principal"><NavigationLinks competitive={competitive} /></nav>
        <div className="side-profile">
          <div className="avatar" aria-hidden="true">{user?.fullName.charAt(0)}</div>
          <div><strong>{user?.fullName}</strong><small>Conta pessoal</small></div>
        </div>
        <CreatorCredit className="side-creator-credit" />
      </aside>
      <div className="main-wrap">
        <header className="mobile-header">
          <div className="brand"><span className="brand-mark">N</span><span>{title}</span></div>
          <NavLink to="/perfil" className="avatar" aria-label="Abrir perfil">{user?.fullName.charAt(0)}</NavLink>
        </header>
        <OfflineMealNotice />
        <main><Outlet /></main>
        <CompetitiveRankingWidget />
        <CreatorCredit className="app-creator-credit" />
        <nav className="bottom-nav" aria-label="Navegação principal"><NavigationLinks competitive={competitive} /></nav>
      </div>
    </div>
  )
}
