import { ExternalLink } from 'lucide-react'

const LINKEDIN_URL = 'https://www.linkedin.com/in/keven-araujo-785492285/'

export function CreatorCredit({ className = '' }: { className?: string }) {
  return (
    <footer className={`creator-credit ${className}`.trim()}>
      <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de Keven Lucas Pereira Araujo">
        <span>Criado e desenvolvido por</span>
        <strong>Keven Lucas Pereira Araujo <ExternalLink aria-hidden="true" /></strong>
        <small>© 2026 · Todos os direitos reservados</small>
      </a>
    </footer>
  )
}
