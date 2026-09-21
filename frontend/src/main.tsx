import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './state/AuthContext'
import { DietProvider } from './state/DietContext'
import { OfflineMealProvider } from './state/OfflineMealContext'
import { WaterProvider } from './state/WaterContext'
import App from './App'
import { prepareApi } from './lib/serverWakeup'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento raiz da aplicação não encontrado.')

if (!localStorage.getItem('Dietaday_token')) void prepareApi().catch(() => undefined)

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DietProvider>
          <OfflineMealProvider>
            <WaterProvider><App /></WaterProvider>
          </OfflineMealProvider>
        </DietProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
