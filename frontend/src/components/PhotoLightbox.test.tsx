// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PhotoLightbox } from './PhotoLightbox'

describe('PhotoLightbox', () => {
  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
  })

  it('shows the enlarged photo and closes with Escape', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox source="https://example.com/meal.webp" description="Arroz e feijão" onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'Foto ampliada: Arroz e feijão' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Foto ampliada da refeição: Arroz e feijão' }).getAttribute('src')).toBe('https://example.com/meal.webp')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose from the close button, Escape, and the backdrop', () => {
    let calls = 0
    const onClose = () => { calls += 1 }
    render(<PhotoLightbox source="photo.webp" description="Jantar" onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar foto ampliada' }))
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)

    expect(calls).toBe(3)
  })
})
