import { LoaderCircle, MessageCircle, Pencil, Send, SmilePlus, Trash2, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { chronologicalComments, commentPath, commentReactionPath, commentsPath, commentsResourceKey, removeComment, replaceComment } from '../lib/comments'
import { mealTime } from '../lib/date'
import { optimisticReactions } from '../lib/mealReactions'
import { readCachedResource, writeCachedResource } from '../lib/resourceCache'
import { createUuid } from '../lib/uuid'
import { useAuth } from '../state/AuthContext'
import type { Meal, MealComment, MealReaction } from '../types'
import { ReactionPicker } from './ReactionPicker'

type CommentsModalProps = {
  dietId: string
  meal: Meal
  highlightedCommentId?: string | null
  onClose: () => void
  onCommentCountChange: (delta: number) => void
  onCommentsSettled: () => void
}

export function CommentsModal({ dietId, meal, highlightedCommentId, onClose, onCommentCountChange, onCommentsSettled }: CommentsModalProps) {
  const { token, user } = useAuth()
  const cacheKey = commentsResourceKey(dietId, meal.id)
  const cached = user ? readCachedResource<MealComment[]>(user.id, cacheKey) : null
  const [comments, setComments] = useState(() => chronologicalComments(cached?.data ?? []))
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [processingIds, setProcessingIds] = useState<Set<string>>(() => new Set())
  const [pickerCommentId, setPickerCommentId] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const dialogRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const submittingRef = useRef(submitting)
  const processingIdsRef = useRef(processingIds)
  const mutationRevisionRef = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  submittingRef.current = submitting
  processingIdsRef.current = processingIds
  const canWrite = online && !meal.syncStatus && !isDemoMode

  function updateComments(update: (current: MealComment[]) => MealComment[]) {
    setComments((current) => {
      const next = chronologicalComments(update(current))
      if (user) writeCachedResource(user.id, cacheKey, next)
      return next
    })
  }

  const loadComments = useEffectEvent(async (signal?: AbortSignal) => {
    if (!token || !user || !online || meal.syncStatus || isDemoMode) {
      setLoading(false)
      return
    }
    const mutationRevision = mutationRevisionRef.current
    try {
      const data = await api<MealComment[]>(commentsPath(dietId, meal.id), { token, signal })
      if (signal?.aborted || mutationRevision !== mutationRevisionRef.current) return
      const ordered = chronologicalComments(data)
      setComments(ordered)
      writeCachedResource(user.id, cacheKey, ordered)
      setError('')
    } catch (loadError) {
      if (!signal?.aborted) setError(getErrorMessage(loadError, 'Não foi possível carregar os comentários.'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  })

  useEffect(() => {
    const controller = new AbortController()
    void loadComments(controller.signal)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !submittingRef.current && processingIdsRef.current.size === 0) {
        void loadComments(controller.signal)
      }
    }
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      controller.abort()
    }
  }, [cacheKey])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    titleRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('.emoji-picker-dialog')) return
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const outside = !dialogRef.current.contains(document.activeElement)
      if (event.shiftKey && (outside || document.activeElement === first || document.activeElement === titleRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    if (!highlightedCommentId || loading) return
    const highlighted = dialogRef.current?.querySelector<HTMLElement>(`[data-comment-id="${highlightedCommentId}"]`)
    highlighted?.scrollIntoView({ block: 'center' })
    highlighted?.focus({ preventScroll: true })
  }, [highlightedCommentId, loading, comments.length])

  async function submitComment(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!token || !user || !canWrite || !content || submitting) return
    const temporaryId = `pending-${createUuid()}`
    const temporary: MealComment = {
      id: temporaryId,
      mealId: meal.id,
      authorId: user.id,
      authorName: user.fullName,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reactions: [],
    }
    setSubmitting(true)
    mutationRevisionRef.current += 1
    setError('')
    updateComments((current) => [...current, temporary])
    onCommentCountChange(1)
    try {
      const created = await api<MealComment>(commentsPath(dietId, meal.id), { method: 'POST', token, body: JSON.stringify({ content }) })
      updateComments((current) => chronologicalComments(current.map((comment) => comment.id === temporaryId ? { ...created, reactions: created.reactions ?? [] } : comment)))
      setDraft('')
      onCommentsSettled()
    } catch (submitError) {
      updateComments((current) => removeComment(current, temporaryId))
      onCommentCountChange(-1)
      setError(getErrorMessage(submitError, 'Não foi possível enviar o comentário.'))
      void loadComments()
    } finally {
      setSubmitting(false)
    }
  }

  function beginEdit(comment: MealComment) {
    setEditingId(comment.id)
    setEditDraft(comment.content)
    setError('')
  }

  async function saveEdit(comment: MealComment) {
    const content = editDraft.trim()
    if (!token || !canWrite || !content || processingIds.has(comment.id)) return
    const optimistic = { ...comment, content, updatedAt: new Date().toISOString() }
    mutationRevisionRef.current += 1
    setProcessingIds((current) => new Set(current).add(comment.id))
    updateComments((current) => replaceComment(current, optimistic))
    try {
      const updated = await api<MealComment>(commentPath(dietId, meal.id, comment.id), { method: 'PUT', token, body: JSON.stringify({ content }) })
      updateComments((current) => replaceComment(current, { ...updated, reactions: updated.reactions ?? comment.reactions }))
      setEditingId(null)
    } catch (editError) {
      updateComments((current) => replaceComment(current, comment))
      setError(getErrorMessage(editError, 'Não foi possível editar o comentário.'))
      void loadComments()
    } finally {
      setProcessingIds((current) => { const next = new Set(current); next.delete(comment.id); return next })
    }
  }

  async function deleteComment(comment: MealComment) {
    if (!token || !canWrite || processingIds.has(comment.id) || !window.confirm('Excluir este comentário?')) return
    mutationRevisionRef.current += 1
    setProcessingIds((current) => new Set(current).add(comment.id))
    updateComments((current) => removeComment(current, comment.id))
    onCommentCountChange(-1)
    try {
      await api<void>(commentPath(dietId, meal.id, comment.id), { method: 'DELETE', token })
      onCommentsSettled()
    } catch (deleteError) {
      updateComments((current) => [...current, comment])
      onCommentCountChange(1)
      setError(getErrorMessage(deleteError, 'Não foi possível excluir o comentário.'))
      void loadComments()
    } finally {
      setProcessingIds((current) => { const next = new Set(current); next.delete(comment.id); return next })
    }
  }

  async function react(comment: MealComment, emoji: string) {
    if (!token || !user || !canWrite || meal.authorId !== user.id || comment.authorId === user.id || processingIds.has(comment.id)) return
    const ownReaction = comment.reactions.find((reaction) => reaction.reactedByMe)?.emoji
    const nextEmoji = ownReaction === emoji ? null : emoji
    const optimistic = optimisticReactions(comment.reactions, nextEmoji)
    mutationRevisionRef.current += 1
    setPickerCommentId(null)
    setProcessingIds((current) => new Set(current).add(comment.id))
    updateComments((current) => replaceComment(current, { ...comment, reactions: optimistic }))
    try {
      const result = await api<{ reactions: MealReaction[] }>(commentReactionPath(dietId, meal.id, comment.id), {
        method: nextEmoji ? 'PUT' : 'DELETE', token, body: nextEmoji ? JSON.stringify({ emoji: nextEmoji }) : undefined,
      })
      updateComments((current) => replaceComment(current, { ...comment, reactions: result.reactions }))
    } catch (reactionError) {
      updateComments((current) => replaceComment(current, comment))
      setError(getErrorMessage(reactionError, 'Não foi possível salvar sua reação.'))
      void loadComments()
    } finally {
      setProcessingIds((current) => { const next = new Set(current); next.delete(comment.id); return next })
    }
  }

  return (
    <div className="comments-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="comments-modal" role="dialog" aria-modal="true" aria-labelledby="comments-title">
        <header className="comments-header">
          <div><MessageCircle aria-hidden="true" /><div><h2 ref={titleRef} tabIndex={-1} id="comments-title">Comentários</h2><p>{meal.mealType} · {meal.description}</p></div></div>
          <button type="button" className="close" onClick={onClose} aria-label="Fechar comentários"><X /></button>
        </header>
        {!online && <p className="comments-offline">Você está offline. Os comentários salvos continuam disponíveis somente para leitura.</p>}
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="comment-list" aria-live="polite">
          {loading && !comments.length ? <p className="loading-text">Carregando comentários...</p> : comments.length ? comments.map((comment) => {
            const isAuthor = comment.authorId === user?.id
            const canReact = canWrite && meal.authorId === user?.id && !isAuthor
            const processing = processingIds.has(comment.id)
            return (
              <article key={comment.id} data-comment-id={comment.id} tabIndex={-1} className={highlightedCommentId === comment.id ? 'highlighted' : ''}>
                <div className="comment-meta"><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{mealTime(comment.createdAt)}</time></div>
                {editingId === comment.id ? (
                  <div className="comment-edit"><textarea aria-label="Editar comentário" maxLength={1000} rows={3} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} disabled={!canWrite || processing} /><div><button type="button" className="button ghost" onClick={() => setEditingId(null)}>Cancelar</button><button type="button" className="button" disabled={!editDraft.trim() || processing} onClick={() => void saveEdit(comment)}>{processing && <LoaderCircle className="spin" />} Salvar</button></div></div>
                ) : <p>{comment.content}</p>}
                <div className="comment-footer">
                  <div className="comment-reactions" aria-label="Reações do comentário">
                    {comment.reactions.map((reaction) => <button type="button" className={`reaction-pill${reaction.reactedByMe ? ' selected' : ''}`} key={reaction.emoji} disabled={!canReact || processing} aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? 'reação' : 'reações'}${reaction.reactedByMe ? ', sua reação' : ''}`} onClick={() => void react(comment, reaction.emoji)}><span>{reaction.emoji}</span><b>{reaction.count}</b></button>)}
                    {canReact && <button type="button" className="add-reaction" disabled={processing} aria-label="Adicionar reação ao comentário" aria-expanded={pickerCommentId === comment.id} onClick={() => setPickerCommentId(comment.id)}>{processing ? <LoaderCircle className="spin" /> : <SmilePlus />}</button>}
                  </div>
                  {isAuthor && editingId !== comment.id && <div className="comment-actions"><button type="button" disabled={!canWrite || processing} onClick={() => beginEdit(comment)} aria-label="Editar comentário"><Pencil /></button><button type="button" disabled={!canWrite || processing} onClick={() => void deleteComment(comment)} aria-label="Excluir comentário"><Trash2 /></button></div>}
                </div>
                {pickerCommentId === comment.id && <ReactionPicker onClose={() => setPickerCommentId(null)} onSelect={(emoji) => void react(comment, emoji)} />}
              </article>
            )
          }) : <div className="comment-empty"><MessageCircle /><strong>Nenhum comentário ainda</strong><span>Comece a conversa sobre esta refeição.</span></div>}
        </div>
        <form className="comment-composer" onSubmit={(event) => void submitComment(event)}>
          <label htmlFor="new-comment">Novo comentário</label>
          <textarea id="new-comment" rows={3} maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!canWrite || submitting} placeholder={canWrite ? 'Escreva um comentário...' : 'Comentários indisponíveis offline'} />
          <div><small>{draft.length}/1000</small><button className="button" type="submit" disabled={!canWrite || !draft.trim() || submitting}>{submitting ? <LoaderCircle className="spin" /> : <Send />} Enviar</button></div>
        </form>
      </section>
    </div>
  )
}
