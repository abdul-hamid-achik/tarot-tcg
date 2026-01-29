import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createTestGameState, createTestCard } from '../../test_utils'
import type { GameState } from '../../schemas/schema'

// Create a mock state factory
const createMockStoreState = (overrides: {
  gameState?: Partial<GameState>
  interaction?: { targetingMode?: string }
} = {}) => {
  const baseGameState = createTestGameState()

  return {
    gameState: {
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
      targetingMode: 'none',
      ...(overrides.interaction || {}),
    },
  }
}

// Store the current mock state
let mockStoreState = createMockStoreState()

// Track BattlefieldRow render calls
const battlefieldRowCalls: Array<{
  player: string
  units: any[]
  isActive: boolean
  canInteract: boolean
}> = []

// Mock the game store BEFORE importing the component
vi.mock('@/store/game_store', () => ({
  useGameStore: () => mockStoreState,
}))

// Mock BattlefieldRow to capture props
vi.mock('../battlefield/battlefield_row', () => ({
  BattlefieldRow: (props: any) => {
    battlefieldRowCalls.push({
      player: props.player,
      units: props.units,
      isActive: props.isActive,
      canInteract: props.canInteract,
    })
    return (
      <div
        data-testid={`battlefield-row-${props.player}`}
        data-can-interact={props.canInteract}
        data-is-active={props.isActive}
      >
        {props.player} row
      </div>
    )
  },
}))

// Import after mocking
import { Battlefield } from '../battlefield/battlefield'

describe('Battlefield', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    battlefieldRowCalls.length = 0

    // Reset to default state
    mockStoreState = createMockStoreState({
      gameState: {
        activePlayer: 'player1',
        phase: 'action',
        battlefield: {
          playerUnits: Array(7).fill(null),
          enemyUnits: Array(7).fill(null),
          maxSlots: 7,
        },
      },
      interaction: {
        targetingMode: 'none',
      },
    })
  })

  describe('Rendering', () => {
    it('should render both player and enemy rows', () => {
      render(<Battlefield />)

      expect(screen.getByTestId('battlefield-row-player1')).toBeInTheDocument()
      expect(screen.getByTestId('battlefield-row-player2')).toBeInTheDocument()
    })

    it('should pass correct units to each row', () => {
      const playerUnit = createTestCard({ id: 'player-unit-1' })
      const enemyUnit = createTestCard({ id: 'enemy-unit-1' })

      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
          battlefield: {
            playerUnits: [playerUnit, null, null, null, null, null, null],
            enemyUnits: [enemyUnit, null, null, null, null, null, null],
            maxSlots: 7,
          },
        },
      })

      render(<Battlefield />)

      const player1Row = battlefieldRowCalls.find(call => call.player === 'player1')
      const player2Row = battlefieldRowCalls.find(call => call.player === 'player2')

      expect(player1Row?.units[0]).toEqual(playerUnit)
      expect(player2Row?.units[0]).toEqual(enemyUnit)
    })
  })

  describe('canInteract - Player Turn in Action Phase', () => {
    it('should set canInteract=true for enemy row during player action phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')
      expect(enemyRow?.canInteract).toBe(true)
    })

    it('should set canInteract=true for player row during player action phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      expect(playerRow?.canInteract).toBe(true)
    })
  })

  describe('canInteract - Opponent Turn', () => {
    it('should set canInteract=false for enemy row during opponent turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')
      expect(enemyRow?.canInteract).toBe(false)
    })

    it('should set canInteract=false for player row during opponent turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      expect(playerRow?.canInteract).toBe(false)
    })
  })

  describe('canInteract - Non-Action Phases', () => {
    it('should set canInteract=false for both rows during mulligan phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'mulligan',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')

      expect(playerRow?.canInteract).toBe(false)
      expect(enemyRow?.canInteract).toBe(false)
    })

    it('should set canInteract=false for both rows during combat_resolution phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'combat_resolution',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')

      expect(playerRow?.canInteract).toBe(false)
      expect(enemyRow?.canInteract).toBe(false)
    })

    it('should set canInteract=false for both rows during end_round phase', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'end_round',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')

      expect(playerRow?.canInteract).toBe(false)
      expect(enemyRow?.canInteract).toBe(false)
    })
  })

  describe('isActive prop', () => {
    it('should set isActive=true for enemy row when it is opponent turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')
      expect(enemyRow?.isActive).toBe(true)
    })

    it('should set isActive=true for player row when it is player turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      expect(playerRow?.isActive).toBe(true)
    })

    it('should set isActive=false for enemy row when it is player turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player1',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const enemyRow = battlefieldRowCalls.find(call => call.player === 'player2')
      expect(enemyRow?.isActive).toBe(false)
    })

    it('should set isActive=false for player row when it is opponent turn', () => {
      mockStoreState = createMockStoreState({
        gameState: {
          activePlayer: 'player2',
          phase: 'action',
        },
      })

      render(<Battlefield />)

      const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')
      expect(playerRow?.isActive).toBe(false)
    })
  })

  describe('Combined Phase and Turn Logic', () => {
    it('should only allow interaction when both conditions are met: player turn AND action phase', () => {
      // Test all combinations
      const testCases = [
        { activePlayer: 'player1', phase: 'action', expectedCanInteract: true },
        { activePlayer: 'player1', phase: 'mulligan', expectedCanInteract: false },
        { activePlayer: 'player1', phase: 'combat_resolution', expectedCanInteract: false },
        { activePlayer: 'player1', phase: 'end_round', expectedCanInteract: false },
        { activePlayer: 'player2', phase: 'action', expectedCanInteract: false },
        { activePlayer: 'player2', phase: 'mulligan', expectedCanInteract: false },
        { activePlayer: 'player2', phase: 'combat_resolution', expectedCanInteract: false },
        { activePlayer: 'player2', phase: 'end_round', expectedCanInteract: false },
      ]

      for (const testCase of testCases) {
        battlefieldRowCalls.length = 0

        mockStoreState = createMockStoreState({
          gameState: {
            activePlayer: testCase.activePlayer as 'player1' | 'player2',
            phase: testCase.phase as GameState['phase'],
          },
        })

        render(<Battlefield />)

        const playerRow = battlefieldRowCalls.find(call => call.player === 'player1')

        expect(playerRow?.canInteract).toBe(
          testCase.expectedCanInteract,
          `Failed for activePlayer=${testCase.activePlayer}, phase=${testCase.phase}`
        )
      }
    })
  })
})
