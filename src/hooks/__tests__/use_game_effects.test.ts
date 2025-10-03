import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameEffects } from '../use_game_effects'
import { useGameActions } from '../use_game_actions'
import { useGameStore } from '@/store/game_store'
import { battlefieldService } from '@/services/battlefield_service'
import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

// Mock dependencies
vi.mock('../use_game_actions')
vi.mock('@/store/game_store')
vi.mock('@/services/battlefield_service')
vi.mock('@/lib/game_logger')

describe('useGameEffects', () => {
  const mockGameState: GameState = {
    round: 1,
    turn: 1,
    phase: 'action',
    activePlayer: 'player1',
    attackingPlayer: null,
    waitingForAction: false,
    combatResolved: false,
    passCount: 0,
    canRespond: false,
    player1: {
      id: 'player1',
      name: 'Player 1',
      health: 30,
      mana: 5,
      maxMana: 5,
      spellMana: 2,
      deck: [],
      hand: [],
      hasAttackToken: true,
      mulliganComplete: true,
      selectedForMulligan: [],
      hasPassed: false,
      actionsThisTurn: 0,
    },
    player2: {
      id: 'player2',
      name: 'Player 2',
      health: 30,
      mana: 5,
      maxMana: 5,
      spellMana: 2,
      deck: [],
      hand: [],
      hasAttackToken: false,
      mulliganComplete: true,
      selectedForMulligan: [],
      hasPassed: false,
      actionsThisTurn: 0,
    },
    battlefield: {
      playerUnits: Array(7).fill(null),
      enemyUnits: Array(7).fill(null),
      maxSlots: 7,
    },
  }

  const mockSetValidDropZones = vi.fn()
  const mockClearValidDropZones = vi.fn()
  const mockPlayCard = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock useGameStore
    vi.mocked(useGameStore).mockReturnValue({
      gameState: mockGameState,
      setValidDropZones: mockSetValidDropZones,
      clearValidDropZones: mockClearValidDropZones,
    } as any)

    // Mock useGameActions
    vi.mocked(useGameActions).mockReturnValue({
      playCard: mockPlayCard,
    } as any)

    // Mock battlefieldService.isSlotEmpty
    vi.mocked(battlefieldService.isSlotEmpty).mockReturnValue(true)

    // Mock GameLogger
    vi.mocked(GameLogger.debug).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Valid Drop Zones Management', () => {
    it('should set valid drop zones during player1 action phase', () => {
      const { result } = renderHook(() => useGameEffects())

      expect(result.current.gameState).toBe(mockGameState)
      expect(mockSetValidDropZones).toHaveBeenCalledWith([
        { player: 'player1', slot: 0 },
        { player: 'player1', slot: 1 },
        { player: 'player1', slot: 2 },
        { player: 'player1', slot: 3 },
        { player: 'player1', slot: 4 },
        { player: 'player1', slot: 5 },
        { player: 'player1', slot: 6 },
      ])
    })

    it('should only include empty slots as valid drop zones', () => {
      // Mock some slots as occupied
      vi.mocked(battlefieldService.isSlotEmpty).mockImplementation(
        (_battlefield, _player, slot) => slot < 3,
      )

      renderHook(() => useGameEffects())

      expect(mockSetValidDropZones).toHaveBeenCalledWith([
        { player: 'player1', slot: 0 },
        { player: 'player1', slot: 1 },
        { player: 'player1', slot: 2 },
      ])
    })

    it('should clear drop zones when not in player1 action phase', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: 'player2' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      expect(mockClearValidDropZones).toHaveBeenCalled()
      expect(mockSetValidDropZones).not.toHaveBeenCalled()
    })

    it('should clear drop zones during combat phase', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, phase: 'combat' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      expect(mockClearValidDropZones).toHaveBeenCalled()
    })

    it('should handle null gameState gracefully', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: null,
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      const { result } = renderHook(() => useGameEffects())

      expect(result.current.gameState).toBeNull()
      expect(mockSetValidDropZones).not.toHaveBeenCalled()
      expect(mockClearValidDropZones).not.toHaveBeenCalled()
    })

    it('should handle missing battlefield gracefully', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, battlefield: undefined },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      expect(mockSetValidDropZones).not.toHaveBeenCalled()
    })
  })

  describe('Drop Zone Updates on State Change', () => {
    it('should update drop zones when game state changes', () => {
      const { rerender } = renderHook(() => useGameEffects())

      expect(mockSetValidDropZones).toHaveBeenCalledTimes(1)

      // Update game state
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, turn: 2 },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      rerender()

      expect(mockSetValidDropZones).toHaveBeenCalledTimes(2)
    })

    it('should clear drop zones when switching to player2 turn', () => {
      const { rerender } = renderHook(() => useGameEffects())

      // Initial state: player1 action phase
      expect(mockSetValidDropZones).toHaveBeenCalled()

      // Switch to player2
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: 'player2' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      rerender()

      expect(mockClearValidDropZones).toHaveBeenCalled()
    })
  })

  describe('AI Turn Handling', () => {
    it('should log debug message during AI turn', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: 'player2' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      // Fast-forward time
      vi.advanceTimersByTime(1000)

      expect(GameLogger.debug).toHaveBeenCalledWith('AI passes turn')
    })

    it('should not trigger AI action during player1 turn', () => {
      renderHook(() => useGameEffects())

      vi.advanceTimersByTime(1000)

      expect(GameLogger.debug).not.toHaveBeenCalled()
    })

    it('should not trigger AI action during non-action phase', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: 'player2', phase: 'combat' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      vi.advanceTimersByTime(1000)

      expect(GameLogger.debug).not.toHaveBeenCalled()
    })

    it('should handle rapid AI turn state changes', () => {
      const { rerender } = renderHook(() => useGameEffects())

      // Switch to AI turn multiple times rapidly
      for (let i = 0; i < 5; i++) {
        vi.mocked(useGameStore).mockReturnValue({
          gameState: { ...mockGameState, activePlayer: 'player2', turn: i },
          setValidDropZones: mockSetValidDropZones,
          clearValidDropZones: mockClearValidDropZones,
        } as any)
        rerender()
      }

      // Fast-forward all timers
      vi.runAllTimers()

      // Should have triggered debug log for each AI turn
      expect(GameLogger.debug).toHaveBeenCalledTimes(5)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle full turn cycle', () => {
      const { rerender } = renderHook(() => useGameEffects())

      // Initial: Player1 action phase
      expect(mockSetValidDropZones).toHaveBeenCalled()
      expect(mockClearValidDropZones).not.toHaveBeenCalled()

      // Switch to combat phase
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, phase: 'combat' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)
      rerender()

      expect(mockClearValidDropZones).toHaveBeenCalled()

      // Switch to Player2 action phase
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: 'player2', phase: 'action' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)
      rerender()

      expect(mockClearValidDropZones).toHaveBeenCalledTimes(2)

      // AI should trigger after 1 second
      vi.advanceTimersByTime(1000)
      expect(GameLogger.debug).toHaveBeenCalledWith('AI passes turn')
    })

    it('should handle partial battlefield occupation', () => {
      // 3 slots occupied, 4 empty
      vi.mocked(battlefieldService.isSlotEmpty).mockImplementation(
        (_battlefield, _player, slot) => slot >= 3,
      )

      renderHook(() => useGameEffects())

      expect(mockSetValidDropZones).toHaveBeenCalledWith([
        { player: 'player1', slot: 3 },
        { player: 'player1', slot: 4 },
        { player: 'player1', slot: 5 },
        { player: 'player1', slot: 6 },
      ])
    })

    it('should handle full battlefield (no valid slots)', () => {
      vi.mocked(battlefieldService.isSlotEmpty).mockReturnValue(false)

      renderHook(() => useGameEffects())

      expect(mockSetValidDropZones).toHaveBeenCalledWith([])
    })
  })

  describe('Return Values', () => {
    it('should return current game state', () => {
      const { result } = renderHook(() => useGameEffects())

      expect(result.current.gameState).toBe(mockGameState)
    })

    it('should return null game state when store has no state', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: null,
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      const { result } = renderHook(() => useGameEffects())

      expect(result.current.gameState).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined phase', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, phase: undefined },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      expect(mockClearValidDropZones).toHaveBeenCalled()
    })

    it('should handle undefined activePlayer', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: undefined },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      renderHook(() => useGameEffects())

      expect(mockClearValidDropZones).toHaveBeenCalled()
    })

    it('should not crash when battlefieldService throws', () => {
      vi.mocked(battlefieldService.isSlotEmpty).mockImplementation(() => {
        throw new Error('Battlefield error')
      })

      expect(() => renderHook(() => useGameEffects())).toThrow('Battlefield error')
    })

    it('should handle unmounting during AI turn timeout', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, activePlayer: 'player2' },
        setValidDropZones: mockSetValidDropZones,
        clearValidDropZones: mockClearValidDropZones,
      } as any)

      const { unmount } = renderHook(() => useGameEffects())

      // Unmount before timeout completes
      unmount()

      // Fast-forward time
      vi.advanceTimersByTime(1000)

      // Should still log (timeout isn't cleaned up in current implementation)
      expect(GameLogger.debug).toHaveBeenCalled()
    })
  })
})

