import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Diets } from './pages/Diets'
import { History } from './pages/History'
import { MealForm } from './pages/MealForm'
import { Members } from './pages/Members'
import { Profile } from './pages/Profile'
import { Water } from './pages/Water'
import { useAuth } from './state/AuthContext'

function ProtectedLayout() {
  const { user } = useAuth()
  const location = useLocation()
  return user
    ? <Layout />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/cadastro" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dietas" element={<Diets />} />
        <Route path="historico" element={<History />} />
        <Route path="refeicoes/nova" element={<MealForm />} />
        <Route path="membros" element={<Members />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="agua" element={<Water />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
