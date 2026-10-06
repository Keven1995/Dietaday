import { useEffect, useId, useRef } from 'react'
import { isFeatureDiscoveryEnabled } from '../lib/featureDiscoveryFlag'
import { Button } from './Ui'

export type FeatureHintProps = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  onDismiss: () => void
  onVisible?: () => void
  dismissLabel?: string
}

export function FeatureHint({
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
  onVisible,
  dismissLabel = 'Agora não',
}: FeatureHintProps) {
  const titleId = useId()
  const articleRef = useRef<HTMLElement>(null)
  const featureEnabled = isFeatureDiscoveryEnabled()

  useEffect(() => {
    if (!featureEnabled || !onVisible || !articleRef.current) return
    const article = articleRef.current
    if (typeof IntersectionObserver === 'undefined') {
      onVisible()
      return
    }

    let notified = false
    const observer = new IntersectionObserver((entries) => {
      if (notified || !entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) return
      notified = true
      onVisible()
      observer.disconnect()
    }, { threshold: 0 })
    observer.observe(article)
    return () => observer.disconnect()
  }, [featureEnabled, onVisible])

  if (!featureEnabled) return null

  return (
    <article ref={articleRef} className="feature-hint" aria-labelledby={titleId}>
      <div className="feature-hint-copy">
        <span className="overline">Uma dica para você</span>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="feature-hint-actions">
        <Button type="button" className="outline" onClick={onAction}>{actionLabel}</Button>
        <button type="button" className="feature-hint-dismiss" onClick={onDismiss}>{dismissLabel}</button>
      </div>
    </article>
  )
}
