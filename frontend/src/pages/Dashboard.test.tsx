// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialMembers } from '../data'
import { MembersSummary } from './Dashboard'

describe('MembersSummary', () => {
  afterEach(cleanup)

  it('describes a one-member diet as individual', () => {
    render(
      <MemoryRouter>
        <MembersSummary
          members={[initialMembers[0]]}
          loading={false}
          error={false}
          shareHint={false}
          onShareVisible={vi.fn()}
          onShareClicked={vi.fn()}
          onShareDismissed={vi.fn()}
          onInvite={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('DIETA INDIVIDUAL')).toBeTruthy()
    expect(screen.getByText('Sua rotina individual')).toBeTruthy()
    expect(screen.getByText('1 membro acompanha esta dieta.')).toBeTruthy()
  })

  it('preserves the shared-diet summary for multiple members', () => {
    render(
      <MemoryRouter>
        <MembersSummary
          members={initialMembers}
          loading={false}
          error={false}
          shareHint={false}
          onShareVisible={vi.fn()}
          onShareClicked={vi.fn()}
          onShareDismissed={vi.fn()}
          onInvite={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('DIETA COMPARTILHADA')).toBeTruthy()
    expect(screen.getByText('Vocês estão juntos')).toBeTruthy()
    expect(screen.getByText('2 membros acompanham esta dieta.')).toBeTruthy()
  })
})
