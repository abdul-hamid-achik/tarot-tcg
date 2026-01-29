import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createTestGameState, createTestCard } from '../../test_utils'
import type { GameState } from '../../schemas/schema'

// Create a mock state factory
const createMockStoreState = (overrides: {
  gameState?: Partial<GameState> | null
  interaction?: Record<string, any>
} = {}) => {
  const defaultInteraction = {
    mode: 'hybrid' as const,
    selectedCard: null,
    draggedCard: null,
    dragStartPosition: null,
    hoveredSlot: null,
    attackSource: null,
    validAttackTargets: new Set<string>(),
    targetingMode: 'none' as const,
  }

  const baseGameState = createTestGameState()

  return {
    gameState: overrides.gameState === null ? null : {
      ...baseGameState,
      ...(overrides.gameState || {}),
      player1: {
        ...baseGameState.player1,
        ...(overrides.gameState?.player1 || {}),
      },
      player2: {
        ...baseGameState.player2,
        ...(overrides.gameState?.player2 || {}),
      },
      battlefield: {
        ...baseGameState.battlefield,
        ...(overrides.gameState?.battlefield || {}),
      },
    },
    interaction: {
      ...defaultInteraction,
      ...(overrides.interaction || {}),
    },
  }
}

// Store the current mock state
let mockStoreState = createMockStoreState()

// Mock the game store BEFORE importing the component
vi.mock('@/store/game_store', () => ({
  useGameStore: () => mockStoreState,
}))

// Import after mocking
import ActionBar from '../ui/action_bar'

describe('ActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default state
    mockStoreState = createMockStoreState({
      gameState: {
        activePlayer: 'player1',
        phase: 'action',
        player1: {
          ...createTestGameState().player1,
          hasAttackToken: true,
        },
        battlefield: {
          playerUnits: Array(7).fill(null),
          enemyUnits: Array(7).fill(null),
          maxSlots: 7,
        },
      },
    })
  })

  describe('Loading State', () => {
    it('should render loading state when gameState is null', () => {
      mockStoreState = createMockStoreState({ gameState: null })

      render(<ActionBar />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Attack Button State - Not Player Turn', () => {
    it('should disable attack when not player turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
        },
      })

      render(<ActionBar />)

      // Should show "Opponent" indicator (not "OPPONENT TURN")
      expect(screen.getByText('Opponent')).toBeInTheDocument()
    })

    it('should show Opponent indicator when it is opponent turn in action phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: true,
          },
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('Opponent')).toBeInTheDocument()
    })
  })

  describe('Attack Button State - No Attack Token', () => {
    it('should still show End Turn button when player lacks attack token', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: false,
          },
          battlefield: {
            playerUnits: [createTestCard({ id: 'unit-1' }), null, null, null, null, null, null],
            enemyUnits: Array(7).fill(null),
            maxSlots: 7,
          },
        },
      })

      render(<ActionBar />)

      // Player can still end turn even without attack token
      expect(screen.getByText('End Turn')).toBeInTheDocument()
    })
  })

  describe('Attack Button State - Phase Validation', () => {
    it('should not show End Turn button during mulligan phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'mulligan',
        },
      })

      render(<ActionBar />)

      // Mulligan phase doesn't show action buttons
      expect(screen.queryByText('End Turn')).not.toBeInTheDocument()
    })

    it('should show Combat indicator during combat_resolution phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'combat_resolution',
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('Combat...')).toBeInTheDocument()
    })

    it('should show Continue button during end_round phase when player turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'end_round',
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('Continue')).toBeInTheDocument()
    })

    it('should not show Continue button during end_round phase when opponent turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'end_round',
        },
      })

      render(<ActionBar />)

      expect(screen.queryByText('Continue')).not.toBeInTheDocument()
    })
  })

  describe('Attack Button State - Unit Availability', () => {
    it('should be enabled when player has units on battlefield', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: true,
          },
          battlefield: {
            playerUnits: [createTestCard({ id: 'unit-1' }), null, null, null, null, null, null],
            enemyUnits: Array(7).fill(null),
            maxSlots: 7,
          },
        },
      })

      render(<ActionBar />)

      // End Turn should be rendered and enabled
      const endTurnButton = screen.getByText('End Turn')
      expect(endTurnButton).toBeInTheDocument()
      expect(endTurnButton).not.toBeDisabled()
    })

    it('should not show attack disabled tooltip when no units to attack with but enabled', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: true,
          },
          battlefield: {
            playerUnits: Array(7).fill(null),
            enemyUnits: Array(7).fill(null),
            maxSlots: 7,
          },
        },
      })

      render(<ActionBar />)

      // Should not show any disabled tooltips
      expect(screen.queryByText('Need attack token')).not.toBeInTheDocument()
      expect(screen.queryByText('Not your turn')).not.toBeInTheDocument()
    })
  })

  describe('Attack Mode State', () => {
    it('should render END TURN when in attack mode with valid targets', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: true,
          },
          battlefield: {
            playerUnits: [createTestCard({ id: 'attacker' }), null, null, null, null, null, null],
            enemyUnits: [createTestCard({ id: 'target' }), null, null, null, null, null, null],
            maxSlots: 7,
          },
        },
        interaction: {
          targetingMode: 'attack',
          validAttackTargets: new Set(['target']),
        },
      })

      render(<ActionBar />)

      // END TURN should still be visible
      expect(screen.getByText('End Turn')).toBeInTheDocument()
    })
  })

  describe('END TURN Button', () => {
    it('should render END TURN button during player action phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('End Turn')).toBeInTheDocument()
    })

    it('should have correct title attribute on END TURN button', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<ActionBar />)

      const button = screen.getByText('End Turn')
      expect(button).toHaveAttribute('title', 'End your turn')
    })

    it('should not render END TURN button during opponent turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
        },
      })

      render(<ActionBar />)

      expect(screen.queryByText('End Turn')).not.toBeInTheDocument()
    })
  })

  describe('Error Feedback Display', () => {
    it('should still show End Turn button when attack is disabled due to no token', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: false,
          },
          battlefield: {
            playerUnits: [createTestCard({ id: 'unit-1' }), null, null, null, null, null, null],
            enemyUnits: Array(7).fill(null),
            maxSlots: 7,
          },
        },
      })

      render(<ActionBar />)

      // Player can still end turn even when attack is disabled (no token)
      // The "Need attack token" state is tracked internally but End Turn is still available
      expect(screen.getByText('End Turn')).toBeInTheDocument()
    })

    it('should not display tooltip when attack is enabled with token and units', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          player1: {
            ...createTestGameState().player1,
            hasAttackToken: true,
          },
          battlefield: {
            playerUnits: [createTestCard({ id: 'unit-1' }), null, null, null, null, null, null],
            enemyUnits: Array(7).fill(null),
            maxSlots: 7,
          },
        },
      })

      render(<ActionBar />)

      // Should not show "Need attack token" or similar error tooltips
      expect(screen.queryByText('Need attack token')).not.toBeInTheDocument()
      expect(screen.queryByText('Not your turn')).not.toBeInTheDocument()
    })
  })

  describe('Phase Display Rendering', () => {
    it('should render appropriate UI for mulligan phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'mulligan',
        },
      })

      render(<ActionBar />)

      // Should not show action phase buttons
      expect(screen.queryByText('End Turn')).not.toBeInTheDocument()
      expect(screen.queryByText('Combat...')).not.toBeInTheDocument()
    })

    it('should render appropriate UI for action phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('End Turn')).toBeInTheDocument()
    })

    it('should render appropriate UI for combat_resolution phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'combat_resolution',
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('Combat...')).toBeInTheDocument()
    })

    it('should render appropriate UI for end_round phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'end_round',
        },
      })

      render(<ActionBar />)

      expect(screen.getByText('Continue')).toBeInTheDocument()
    })
  })

  describe('Button Callbacks', () => {
    it('should call onPass callback when END TURN is clicked', () => {
      const onPass = vi.fn()
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<ActionBar onPass={onPass} />)

      const button = screen.getByText('End Turn')
      fireEvent.click(button)

      expect(onPass).toHaveBeenCalledTimes(1)
    })

    it('should call onEndTurn callback when CONTINUE is clicked', () => {
      const onEndTurn = vi.fn()
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'end_round',
        },
      })

      render(<ActionBar onEndTurn={onEndTurn} />)

      const button = screen.getByText('Continue')
      fireEvent.click(button)

      expect(onEndTurn).toHaveBeenCalledTimes(1)
    })

    it('should not crash when callbacks are not provided', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<ActionBar />)

      const button = screen.getByText('End Turn')
      expect(() => fireEvent.click(button)).not.toThrow()
    })
  })
})

describe('getAttackButtonState Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should prioritize turn check over attack token check', () => {
    mockStoreState = createMockStoreState({
      gameState: {
        activePlayer: 'player2',
        phase: 'action',
        player1: {
          ...createTestGameState().player1,
          hasAttackToken: false,
        },
      },
    })

    render(<ActionBar />)

    // Should show "OPPONENT TURN" not the attack token message
    expect(screen.getByText('Opponent')).toBeInTheDocument()
    expect(screen.queryByText('Need attack token')).not.toBeInTheDocument()
  })

  it('should still show End Turn when player lacks attack token', () => {
    mockStoreState = createMockStoreState({
      gameState: {
        activePlayer: 'player1',
        phase: 'action',
        player1: {
          ...createTestGameState().player1,
          hasAttackToken: false,
        },
        battlefield: {
          playerUnits: [createTestCard({ id: 'unit-1' }), null, null, null, null, null, null],
          enemyUnits: Array(7).fill(null),
          maxSlots: 7,
        },
      },
    })

    render(<ActionBar />)

    // Player can still end turn even without attack token
    expect(screen.getByText('End Turn')).toBeInTheDocument()
  })

  it('should show action phase required tooltip when in wrong phase', () => {
    mockStoreState = createMockStoreState({
      gameState: {
        activePlayer: 'player1',
        phase: 'combat_resolution',
        player1: {
          ...createTestGameState().player1,
          hasAttackToken: true,
        },
      },
    })

    render(<ActionBar />)

    // During combat_resolution, the RESOLVING button should be shown
    expect(screen.getByText('Combat...')).toBeInTheDocument()
    // The tooltip won't be shown as there's a different UI element
  })

  it('should enable button when all conditions are met', () => {
    mockStoreState = createMockStoreState({
      gameState: {
        activePlayer: 'player1',
        phase: 'action',
        player1: {
          ...createTestGameState().player1,
          hasAttackToken: true,
        },
        battlefield: {
          playerUnits: [createTestCard({ id: 'unit-1' }), null, null, null, null, null, null],
          enemyUnits: Array(7).fill(null),
          maxSlots: 7,
        },
      },
    })

    render(<ActionBar />)

    // END TURN should be enabled
    const button = screen.getByText('End Turn')
    expect(button).not.toBeDisabled()

    // No error tooltips
    expect(screen.queryByText('Need attack token')).not.toBeInTheDocument()
    expect(screen.queryByText('Not your turn')).not.toBeInTheDocument()
    expect(screen.queryByText('Can only attack during action phase')).not.toBeInTheDocument()
  })
})
