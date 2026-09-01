import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestCard, createTestGameState, createTestPlayer } from '@/test_utils'
import type { GameState } from '@/schemas/schema'

const combatActions = {
  handleTargetClick: vi.fn(),
}

let mockStoreState: {
  gameState: GameState
  interaction: {
    targetingMode: string
    validAttackTargets: Set<string>
  }
}

vi.mock('@/store/game_store', () => ({
  useGameStore: () => mockStoreState,
}))

vi.mock('@/hooks/use_combat_actions', () => ({
  useCombatActions: () => combatActions,
}))

vi.mock('@/components/element_synergy_indicator', () => ({
  default: () => null,
}))

import PlayerInfoPanel from '../player/player_info_panel'

describe('PlayerInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = {
      gameState: createTestGameState({
        activePlayer: 'player1',
        phase: 'action',
        player1: createTestPlayer('player1', { hasAttackToken: true }),
        battlefield: {
          playerUnits: [createTestCard({ id: 'ready-1', hasSummoningSickness: false, hasAttackedThisTurn: false }), null, null, null, null, null, null],
          enemyUnits: Array(7).fill(null),
          maxSlots: 7,
        },
      }),
      interaction: {
        targetingMode: 'none',
        validAttackTargets: new Set(),
      },
    }
  })

  it('renders You / Opponent headings', () => {
    const state = mockStoreState.gameState
    const { rerender } = render(
      <PlayerInfoPanel player={state.player1} isCurrentPlayer onEndTurn={vi.fn()} />,
    )
    expect(screen.getByRole('heading', { name: /you/i })).toBeInTheDocument()

    rerender(<PlayerInfoPanel player={state.player2} isCurrentPlayer={false} />)
    expect(screen.getByRole('heading', { name: /opponent/i })).toBeInTheDocument()
  })

  it('shows End Turn on the player rail during the action phase', () => {
    render(
      <PlayerInfoPanel
        player={mockStoreState.gameState.player1}
        isCurrentPlayer
        onEndTurn={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /end turn/i })).toBeInTheDocument()
  })

  it('prompts the current player to lay a reading', () => {
    render(
      <PlayerInfoPanel
        player={mockStoreState.gameState.player1}
        isCurrentPlayer
        onEndTurn={vi.fn()}
      />,
    )
    expect(screen.getByText(/lay a reading/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /attack opponent nexus/i })).not.toBeInTheDocument()
  })
})
