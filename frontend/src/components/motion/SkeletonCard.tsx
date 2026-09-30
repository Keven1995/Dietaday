export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton-card ${className}`.trim()} aria-hidden="true">
      <span className="skeleton-line skeleton-line-title" />
      {Array.from({ length: Math.max(0, lines - 1) }, (_, index) => <span className="skeleton-line" key={index} />)}
    </div>
  )
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return <div className={`skeleton-list ${className}`.trim()} aria-label="Carregando conteúdo">{Array.from({ length: Math.max(1, count) }, (_, index) => <SkeletonCard key={index} />)}</div>
}
