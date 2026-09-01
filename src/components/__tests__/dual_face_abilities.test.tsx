import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DualFaceAbilities } from '../dual_face_abilities'

describe('DualFaceAbilities', () => {
  it('labels upright and reversed faces separately', () => {
    render(
      <DualFaceAbilities
        upright={[{ name: 'Leap of Faith', description: 'Draw a card.' }]}
        reversed={[{ name: 'Reckless Abandon', description: 'Discard your hand.' }]}
      />,
    )

    expect(screen.getByText('Upright')).toBeInTheDocument()
    expect(screen.getByText('Reversed')).toBeInTheDocument()
    expect(screen.getByText(/Leap of Faith/)).toBeInTheDocument()
    expect(screen.getByText(/Reckless Abandon/)).toBeInTheDocument()
  })
})
