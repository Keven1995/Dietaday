import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './state/AuthContext'

const AuthPage = lazy(() => import('./pages/Auth').then(({ AuthPage: page }) => ({ default: page })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(({ Dashboard: page }) => ({ default: page })))
const Diets = lazy(() => import('./pages/Diets').then(({ Diets: page }) => ({ default: page })))
const History = lazy(() => import('./pages/History').then(({ History: page }) => ({ default: page })))
const MealForm = lazy(() => import('./pages/MealForm').then(({ MealForm: page }) => ({ default: page })))
const Members = lazy(() => import('./pages/Members').then(({ Members: page }) => ({ default: page })))
const Profile = lazy(() => import('./pages/Profile').then(({ Profile: page }) => ({ default: page })))
const Water = lazy(() => import('./pages/Water').then(({ Water: page }) => ({ default: page })))
const Ranking = lazy(() => import('./pages/Ranking').then(({ Ranking: page }) => ({ default: page })))
const PasswordResetPage = lazy(() => import('./pages/AccountSecurity').then(({ PasswordResetPage: page }) => ({ default: page })))
const VerifyEmailPage = lazy(() => import('./pages/AccountSecurity').then(({ VerifyEmailPage: page }) => ({ default: page })))

function RouteFallback() {
  return <div className="page" role="status" aria-live="polite"><p className="loading-text">Carregando página...</p></div>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function ProtectedLayout() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return null
  return user
    ? <Layout />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LazyRoute><AuthPage mode="login" /></LazyRoute>} />
      <Route path="/cadastro" element={<LazyRoute><AuthPage mode="register" /></LazyRoute>} />
      <Route path="/recuperar-senha" element={<LazyRoute><PasswordResetPage /></LazyRoute>} />
      <Route path="/redefinir-senha" element={<LazyRoute><PasswordResetPage /></LazyRoute>} />
      <Route path="/verificar-email" element={<LazyRoute><VerifyEmailPage /></LazyRoute>} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<LazyRoute><Dashboard /></LazyRoute>} />
        <Route path="dietas" element={<LazyRoute><Diets /></LazyRoute>} />
        <Route path="historico" element={<LazyRoute><History /></LazyRoute>} />
        <Route path="refeicoes/nova" element={<LazyRoute><MealForm /></LazyRoute>} />
        <Route path="membros" element={<LazyRoute><Members /></LazyRoute>} />
        <Route path="perfil" element={<LazyRoute><Profile /></LazyRoute>} />
        <Route path="agua" element={<LazyRoute><Water /></LazyRoute>} />
        <Route path="ranking" element={<LazyRoute><Ranking /></LazyRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
