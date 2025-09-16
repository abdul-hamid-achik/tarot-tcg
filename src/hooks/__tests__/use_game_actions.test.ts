import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameActions } from '@/hooks/use_game_actions'
import { useGameStore } from '@/store/game_store'
import type { GameState } from '@/schemas/schema'

// Mock dependencies
vi.mock('@/store/game_store')
vi.mock('@/services/state_manager')
vi.mock('@/services/animation_service')
vi.mock('@/services/CombatService')
vi.mock('@/services/AIService')

const createTestGameState = (): GameState => ({
  round: 1,
  turn: 1,
  activePlayer: 'player1',
  attackingPlayer: null,
  player1: {
    id: 'player1',
    name: 'Human',
    health: 20,
    mana: 3,
    maxMana: 3,
    spellMana: 1,
    hand: [
      {
        id: 'card-1',
        name: 'Test Card',
        cost: 2,
        attack: 2,
        health: 3,
        type: 'unit',
        tarotSymbol: '1',
        description: 'A test card',
        zodiacClass: 'aries',
        element: 'fire',
        rarity: 'common'
      }
    ],
    deck: [],
    bench: [],
    hasAttackToken: true,
    mulliganComplete: true,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  },
  player2: {
    id: 'player2',
    name: 'AI',
    health: 20,
    mana: 3,
    maxMana: 3,
    spellMana: 0,
    hand: [],
    deck: [],
    bench: [],
    hasAttackToken: false,
    mulliganComplete: true,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  },
  lanes: Array(6).fill(null).map((_, id) => ({ id, attacker: null, defender: null })),
  phase: 'action',
  waitingForAction: false,
  combatResolved: false,
})

describe('useGameActions', () => {
  const mockSetGameState = vi.fn()
  const mockSetAnimationState = vi.fn()
  const mockClearAttackers = vi.fn()
  const mockClearDefenderAssignments = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock useGameStore
    vi.mocked(useGameStore).mockReturnValue({
      gameState: createTestGameState(),
      setGameState: mockSetGameState,
      clearAttackers: mockClearAttackers,
      clearDefenderAssignments: mockClearDefenderAssignments,
      setAnimationState: mockSetAnimationState,
    } as any)

    // Mock DOM methods
    global.document.querySelector = vi.fn().mockReturnValue({
      style: {},
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100 })
    })
  })

  describe('playCard', () => {
    it('should play a card successfully', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      const testCard = gameState.player1.hand[0]

      await act(async () => {
        await result.current.playCard(testCard)
      })

      expect(mockSetAnimationState).toHaveBeenCalledWith(true)
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
      expect(mockSetGameState).toHaveBeenCalled()
    })

    it('should handle insufficient mana', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.player1.mana = 0
      gameState.player1.spellMana = 0
      
      // Update the mock to return the modified state
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      const testCard = gameState.player1.hand[0]

      await act(async () => {
        await result.current.playCard(testCard)
      })

      // Should still set animation states but not call setGameState for actual play
      expect(mockSetAnimationState).toHaveBeenCalledWith(true)
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
    })

    it('should handle errors gracefully', async () => {
      const { result } = renderHook(() => useGameActions())
      
      // Mock setGameState to throw an error
      mockSetGameState.mockImplementationOnce(() => {
        throw new Error('Test error')
      })

      const gameState = createTestGameState()
      const testCard = gameState.player1.hand[0]

      await act(async () => {
        await result.current.playCard(testCard)
      })

      // Should still clean up animation state even on error
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
    })
  })

  describe('declareAttack', () => {
    it('should declare attack with valid units', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      
      // Add a unit to bench
      gameState.player1.bench = [{
        id: 'unit-1',
        name: 'Test Unit',
        cost: 2,
        attack: 2,
        health: 3,
        currentHealth: 3,
        type: 'unit',
        tarotSymbol: '1',
        description: 'Test unit',
        zodiacClass: 'aries',
        element: 'fire',
        rarity: 'common',
        position: 'bench'
      }]

      await act(async () => {
        await result.current.declareAttack(['unit-1'])
      })

      expect(mockSetGameState).toHaveBeenCalled()
      expect(mockClearAttackers).toHaveBeenCalled()
    })

    it('should not attack without attack token', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.player1.hasAttackToken = false
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.declareAttack(['unit-1'])
      })

      // Should return early without calling setGameState
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
    })
  })

  describe('declareDefenders', () => {
    it('should declare defenders in correct phase', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.phase = 'declare_defenders'
      gameState.activePlayer = 'player2'
      gameState.attackingPlayer = 'player1'
      
      // Set up attacking scenario
      gameState.lanes[0].attacker = {
        id: 'attacker-1',
        name: 'Attacker',
        cost: 2,
        attack: 2,
        health: 3,
        type: 'unit',
        tarotSymbol: '1',
        description: 'Attacking unit',
        zodiacClass: 'aries',
        element: 'fire',
        rarity: 'common',
        position: 'attacking'
      }

      gameState.player2.bench = [{
        id: 'defender-1',
        name: 'Defender',
        cost: 2,
        attack: 1,
        health: 4,
        currentHealth: 4,
        type: 'unit',
        tarotSymbol: '2',
        description: 'Defending unit',
        zodiacClass: 'taurus',
        element: 'earth',
        rarity: 'common',
        position: 'bench'
      }]

      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.declareDefenders([{ defenderId: 'defender-1', laneId: 0 }])
      })

      expect(mockSetGameState).toHaveBeenCalled()
      expect(mockClearDefenderAssignments).toHaveBeenCalled()
    })

    it('should not declare defenders in wrong phase', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.phase = 'action' // Wrong phase
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.declareDefenders([{ defenderId: 'defender-1', laneId: 0 }])
      })

      // Should return early
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
    })
  })

  describe('endTurn', () => {
    it('should end turn and switch players', async () => {
      const { result } = renderHook(() => useGameActions())

      await act(async () => {
        await result.current.endTurn()
      })

      expect(mockSetGameState).toHaveBeenCalled()
      expect(mockClearAttackers).toHaveBeenCalled()
      expect(mockClearDefenderAssignments).toHaveBeenCalled()
    })

    it('should handle AI turn transition', async () => {
      const { result } = renderHook(() => useGameActions())
      
      await act(async () => {
        await result.current.endTurn()
      })

      // Should set up for AI turn
      expect(mockSetGameState).toHaveBeenCalled()
    })
  })

  describe('completeMulligan', () => {
    it('should complete mulligan phase', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.phase = 'mulligan'
      gameState.player1.mulliganComplete = false
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.completeMulligan(['card-1'])
      })

      expect(mockSetGameState).toHaveBeenCalled()
    })

    it('should not complete mulligan in wrong phase', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.phase = 'action' // Wrong phase
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.completeMulligan(['card-1'])
      })

      // Should return early
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
    })
  })

  describe('resolveCombat', () => {
    it('should resolve combat in combat phase', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.phase = 'combat'
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.resolveCombat()
      })

      expect(mockSetGameState).toHaveBeenCalled()
    })
  })

  describe('reverseCard', () => {
    it('should reverse a card', async () => {
      const { result } = renderHook(() => useGameActions())

      await act(async () => {
        await result.current.reverseCard('card-1')
      })

      expect(mockSetGameState).toHaveBeenCalled()
    })
  })

  describe('executeAITurn', () => {
    it('should execute AI turn when AI is active', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.activePlayer = 'player2'
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.executeAITurn()
      })

      expect(mockSetAnimationState).toHaveBeenCalledWith(true)
      expect(mockSetAnimationState).toHaveBeenCalledWith(false)
    })

    it('should not execute AI turn when player1 is active', async () => {
      const { result } = renderHook(() => useGameActions())
      const gameState = createTestGameState()
      gameState.activePlayer = 'player1'
      
      vi.mocked(useGameStore).mockReturnValue({
        gameState,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
      } as any)

      await act(async () => {
        await result.current.executeAITurn()
      })

      // Should return early without setting animation state
      expect(mockSetAnimationState).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in all actions', async () => {
      const { result } = renderHook(() => useGameActions())
      
      // Mock an error in setGameState
      mockSetGameState.mockImplementation(() => {
        throw new Error('Test error')
      })

      const actions = [
        () => result.current.playCard(createTestGameState().player1.hand[0]),
        () => result.current.declareAttack(['unit-1']),
        () => result.current.declareDefenders([{ defenderId: 'def-1', laneId: 0 }]),
        () => result.current.endTurn(),
        () => result.current.completeMulligan(['card-1']),
        () => result.current.resolveCombat(),
        () => result.current.reverseCard('card-1'),
        () => result.current.executeAITurn()
      ]

      for (const action of actions) {
        await act(async () => {
          await action()
        })
        
        // Should always clean up animation state even on error
        expect(mockSetAnimationState).toHaveBeenCalledWith(false)
        
        // Reset mock calls
        mockSetAnimationState.mockClear()
      }
    })
  })
})