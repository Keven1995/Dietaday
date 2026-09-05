import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './state/AuthContext'
import { DietProvider } from './state/DietContext'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento raiz da aplicação não encontrado.')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DietProvider>
          <App />
        </DietProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
