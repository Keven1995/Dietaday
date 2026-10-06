import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './state/AuthContext'
import { DietProvider } from './state/DietContext'
import { OfflineMealProvider } from './state/OfflineMealContext'
import { WaterProvider } from './state/WaterContext'
import { CelebrationProvider } from './state/CelebrationContext'
import { ToastProvider } from './state/ToastContext'
import { SeasonalTheme } from './seasonal/SeasonalTheme'
import App from './App'
import { prepareApi } from './lib/serverWakeup'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento raiz da aplicação não encontrado.')

if (!localStorage.getItem('Dietaday_token')) void prepareApi().catch(() => undefined)

createRoot(root).render(
  <StrictMode>
    <SeasonalTheme>
      <BrowserRouter>
        <AuthProvider>
          <DietProvider>
            <CelebrationProvider>
              <ToastProvider>
                <OfflineMealProvider>
                  <WaterProvider><App /></WaterProvider>
                </OfflineMealProvider>
              </ToastProvider>
            </CelebrationProvider>
          </DietProvider>
        </AuthProvider>
      </BrowserRouter>
    </SeasonalTheme>
  </StrictMode>,
)
