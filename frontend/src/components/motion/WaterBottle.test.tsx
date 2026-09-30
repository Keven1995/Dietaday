// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WaterBottle } from './WaterBottle'
import { setReducedMotionPreference } from '../../test/matchMedia'

describe('WaterBottle', () => {
  beforeEach(() => setReducedMotionPreference(false))
  afterEach(cleanup)

  it('renders the clamped progress in its accessible label and bottle label', () => {
    const { container } = render(<WaterBottle current={750} goal={1000} />)

    expect(screen.getByRole('img', { name: 'Garrafa preenchida em 75%' })).toBeTruthy()
    expect(screen.getByText('75%')).toBeTruthy()
    expect(container.querySelector('.bottle-wave')).not.toBeNull()
  })

  it('handles a zero goal without rendering a wave', () => {
    const { container } = render(<WaterBottle current={500} goal={0} />)

    expect(screen.getByRole('img', { name: 'Garrafa preenchida em 0%' })).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
    expect(container.querySelector('.bottle-wave')).toBeNull()
  })

  it('does not exceed 100 percent when current water is above the goal', () => {
    render(<WaterBottle current={1500} goal={1000} />)

    expect(screen.getByRole('img', { name: 'Garrafa preenchida em 100%' })).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
  })
})
