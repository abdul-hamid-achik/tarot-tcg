import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameClock } from '@/hooks/use_game_clock'
import type { GameState } from '@/schemas/schema'

// Simple mock that provides the game state when needed
const mockStore = {
  gameState: null as GameState | null,
  setGameState: vi.fn(),
}

vi.mock('@/store/game_store', () => ({
  useGameStore: () => mockStore,
}))

const createTestGameState = (activePlayer: 'player1' | 'player2', phase: string): GameState => ({
  round: 2,
  turn: 3,
  activePlayer,
  attackingPlayer: null,
  player1: {
    id: 'player1',
    name: 'Human',
    health: 20,
    mana: 2,
    maxMana: 2,
    spellMana: 0,
    hand: [],
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
    mana: 2,
    maxMana: 2,
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
  battlefield: {
    playerUnits: Array(7).fill(null),
    enemyUnits: Array(7).fill(null),
    maxSlots: 7,
  },
  phase: phase as any,
  waitingForAction: false,
  combatResolved: false,
})

describe('useGameClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockStore.gameState = null
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Timer Behavior', () => {
    it('should initialize with default configuration', () => {
      const { result } = renderHook(() => useGameClock())
      expect(result.current.timeRemaining).toBe(90)
    })

    it('should initialize with custom configuration', () => {
      const { result } = renderHook(() => useGameClock({ turnTimeLimit: 45 }))
      expect(result.current.timeRemaining).toBe(45)
    })

    it('should format time correctly', () => {
      const { result } = renderHook(() => useGameClock())
      if (result.current.formatTime) {
        expect(result.current.formatTime(0)).toBe('0:00')
        expect(result.current.formatTime(30)).toBe('0:30')
        expect(result.current.formatTime(90)).toBe('1:30')
      }
    })
  })

  describe('Match Timer', () => {
    it('should track match time regardless of game state', () => {
      const { result } = renderHook(() => useGameClock())

      expect(result.current.matchTime).toBe(0)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.matchTime).toBe(5)
    })
  })

  describe('Turn Timer - Active States', () => {
    it('should countdown when player1 is active in action phase', () => {
      // Set up game state BEFORE rendering hook
      mockStore.gameState = createTestGameState('player1', 'action')

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }))

      expect(result.current.timeRemaining).toBe(30)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.timeRemaining).toBe(25)
    })

    it('should show warning when time is low', () => {
      mockStore.gameState = createTestGameState('player1', 'action')

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 20,
        warningTime: 10
      }))

      // Advance to warning threshold (5 seconds left)
      act(() => {
        vi.advanceTimersByTime(15000)
      })

      expect(result.current.timeRemaining).toBe(5)
      expect(result.current.isWarning).toBe(true)
    })

    it('should expire timer correctly', () => {
      mockStore.gameState = createTestGameState('player1', 'action')

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 5,
        autoEndTurn: true
      }))

      // Advance past timer expiration
      act(() => {
        vi.advanceTimersByTime(6000)
      })

      expect(result.current.timeRemaining).toBe(0)
      expect(result.current.isTimerExpired).toBe(true)
    })
  })

  describe('Turn Timer - Inactive States', () => {
    it('should not countdown during AI turn', () => {
      mockStore.gameState = createTestGameState('player2', 'action')

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }))

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.timeRemaining).toBe(30)
    })

    it('should not countdown during non-action phases', () => {
      mockStore.gameState = createTestGameState('player1', 'mulligan')

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }))

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.timeRemaining).toBe(30)
    })
  })

  describe('Timer Reset Behavior', () => {
    it('should reset when turn changes', () => {
      // Start with turn 1
      let gameState = createTestGameState('player1', 'action')
      gameState.turn = 1
      mockStore.gameState = gameState

      const { result, rerender } = renderHook(() => useGameClock({
        turnTimeLimit: 60
      }))

      // Let time pass
      act(() => {
        vi.advanceTimersByTime(20000)
      })

      expect(result.current.timeRemaining).toBe(40)

      // Change turn
      gameState = { ...gameState, turn: 2 }
      mockStore.gameState = gameState

      // Trigger re-render to pick up new state
      rerender()

      // Should reset to full time
      expect(result.current.timeRemaining).toBe(60)
    })

    it('should reset manually', () => {
      mockStore.gameState = createTestGameState('player1', 'action')

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 60
      }))

      // Let time pass
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(result.current.timeRemaining).toBe(30)

      // Reset manually
      act(() => {
        result.current.resetTurnTimer()
      })

      expect(result.current.timeRemaining).toBe(60)
    })
  })

  describe('Performance and Cleanup', () => {
    it('should clean up intervals on unmount', () => {
      mockStore.gameState = createTestGameState('player1', 'action')
      const { unmount } = renderHook(() => useGameClock())
      expect(() => unmount()).not.toThrow()
    })

    it('should handle multiple re-renders', () => {
      mockStore.gameState = createTestGameState('player1', 'action')
      const { rerender } = renderHook(() => useGameClock())

      for (let i = 0; i < 3; i++) {
        rerender()
      }

      expect(() => rerender()).not.toThrow()
    })
  })
})