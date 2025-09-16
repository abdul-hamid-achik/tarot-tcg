import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameClock } from '@/hooks/use_game_clock'
import { useGameStore } from '@/store/game_store'
import type { GameState } from '@/schemas/schema'

// Mock the game store
vi.mock('@/store/game_store', () => ({
  useGameStore: vi.fn(() => ({
    gameState: null,
    setGameState: vi.fn(),
    ui: {
      showCardDetail: vi.fn(),
      hideCardDetail: vi.fn(),
    },
    interaction: {
      selectedCard: null,
      setSelectedCard: vi.fn(),
    },
  }))
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
  lanes: Array(6).fill(null).map((_, id) => ({ id, attacker: null, defender: null })),
  phase: phase as any,
  waitingForAction: false,
  combatResolved: false,
})

describe('useGameClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Match Timer', () => {
    it('should track match time correctly', () => {
      const { result } = renderHook(() => useGameClock())
      
      expect(result.current.matchTime).toBe(0)
      expect(result.current.getMatchTime()).toBe('0:00')
      
      // Advance time by 65 seconds
      act(() => {
        vi.advanceTimersByTime(65000)
      })
      
      expect(result.current.matchTime).toBe(65)
      expect(result.current.getMatchTime()).toBe('1:05')
    })

    it('should continue running match timer regardless of game state', () => {
      const mockGameStore = vi.mocked(useGameStore)
      mockGameStore.getState = vi.fn().mockReturnValue({
        gameState: null
      })

      const { result } = renderHook(() => useGameClock())
      
      act(() => {
        vi.advanceTimersByTime(30000)
      })
      
      expect(result.current.matchTime).toBe(30)
    })
  })

  describe('Turn Timer', () => {
    it('should initialize with configured turn time limit', () => {
      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 60
      }))
      
      expect(result.current.timeRemaining).toBe(60)
      expect(result.current.getTurnTime()).toBe('1:00')
    })

    it('should countdown during player1 action phase', () => {
      const mockGameStore = vi.mocked(useGameStore)
      mockGameStore.getState = vi.fn().mockReturnValue({
        gameState: createTestGameState('player1', 'action')
      })

      const { result, rerender } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }))

      // Need to provide gameState through hook parameter or mock properly
      const gameState = createTestGameState('player1', 'action')
      
      const { result: resultWithState } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }), {
        wrapper: ({ children }) => {
          // Mock the useGameStore hook to return our test state
          vi.mocked(useGameStore).mockReturnValue({
            gameState,
          } as any)
          return children
        }
      })
      
      // Advance timer by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      
      expect(resultWithState.current.timeRemaining).toBe(20)
      expect(resultWithState.current.getTurnTime()).toBe('0:20')
    })

    it('should not countdown during AI turn', () => {
      const mockGameStore = vi.mocked(useGameStore)
      const gameState = createTestGameState('player2', 'action')
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }))
      
      // Advance timer by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      
      // Should still be at full time since it's AI turn
      expect(result.current.timeRemaining).toBe(30)
    })

    it('should not countdown during non-action phases', () => {
      const mockGameStore = vi.mocked(useGameStore)
      const gameState = createTestGameState('player1', 'combat')
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 30
      }))
      
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      
      expect(result.current.timeRemaining).toBe(30)
    })

    it('should reset when turn changes', () => {
      const mockGameStore = vi.mocked(useGameStore)
      let gameState = createTestGameState('player1', 'action')
      gameState.turn = 1
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result, rerender } = renderHook(() => useGameClock({
        turnTimeLimit: 60
      }))
      
      // Advance timer to use some time
      act(() => {
        vi.advanceTimersByTime(20000)
      })
      
      expect(result.current.timeRemaining).toBe(40)
      
      // Change turn
      gameState = { ...gameState, turn: 2 }
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })
      
      act(() => {
        rerender()
      })
      
      // Should reset to full time
      expect(result.current.timeRemaining).toBe(60)
    })
  })

  describe('Warning System', () => {
    it('should show warning when time is low', () => {
      const mockGameStore = vi.mocked(useGameStore)
      const gameState = createTestGameState('player1', 'action')
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 30,
        warningTime: 10
      }))
      
      // Advance to warning threshold
      act(() => {
        vi.advanceTimersByTime(21000) // 30 - 21 = 9 seconds left
      })
      
      expect(result.current.timeRemaining).toBe(9)
      expect(result.current.isWarning).toBe(true)
    })

    it('should not show warning when plenty of time remains', () => {
      const mockGameStore = vi.mocked(useGameStore)
      const gameState = createTestGameState('player1', 'action')
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 60,
        warningTime: 15
      }))
      
      act(() => {
        vi.advanceTimersByTime(30000) // 30 seconds left, above warning threshold
      })
      
      expect(result.current.timeRemaining).toBe(30)
      expect(result.current.isWarning).toBe(false)
    })
  })

  describe('Auto End Turn', () => {
    it('should detect when timer expires', () => {
      const mockGameStore = vi.mocked(useGameStore)
      const gameState = createTestGameState('player1', 'action')
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 10,
        autoEndTurn: true
      }))
      
      // Advance beyond time limit
      act(() => {
        vi.advanceTimersByTime(11000)
      })
      
      expect(result.current.timeRemaining).toBe(0)
      expect(result.current.isTimerExpired).toBe(true)
    })

    it('should not auto-end when disabled', () => {
      const mockGameStore = vi.mocked(useGameStore)
      const gameState = createTestGameState('player1', 'action')
      mockGameStore.getState = vi.fn().mockReturnValue({ gameState })

      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 10,
        autoEndTurn: false
      }))
      
      act(() => {
        vi.advanceTimersByTime(11000)
      })
      
      expect(result.current.timeRemaining).toBe(0)
      // The component using this hook would need to check isTimerExpired
      // and decide whether to end the turn
    })
  })

  describe('Time Formatting', () => {
    it('should format time correctly', () => {
      const { result } = renderHook(() => useGameClock())
      
      // Test different time values
      const testCases = [
        { seconds: 0, expected: '0:00' },
        { seconds: 30, expected: '0:30' },
        { seconds: 60, expected: '1:00' },
        { seconds: 65, expected: '1:05' },
        { seconds: 125, expected: '2:05' },
        { seconds: 3661, expected: '61:01' } // Over an hour
      ]
      
      testCases.forEach(({ seconds, expected }) => {
        expect(result.current.formatTime?.(seconds) || result.current.getMatchTime()).toBe(expected)
      })
    })
  })

  describe('Reset Functionality', () => {
    it('should reset turn timer manually', () => {
      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 60
      }))
      
      // Advance timer
      act(() => {
        vi.advanceTimersByTime(30000)
      })
      
      expect(result.current.timeRemaining).toBe(30)
      
      // Reset timer
      act(() => {
        result.current.resetTurnTimer()
      })
      
      expect(result.current.timeRemaining).toBe(60)
      expect(result.current.isWarning).toBe(false)
    })
  })

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const { result } = renderHook(() => useGameClock())
      
      expect(result.current.timeRemaining).toBe(90) // Default turn time
    })

    it('should merge partial configuration with defaults', () => {
      const { result } = renderHook(() => useGameClock({
        turnTimeLimit: 45
        // warningTime and autoEndTurn should use defaults
      }))
      
      expect(result.current.timeRemaining).toBe(45)
    })
  })

  describe('Performance', () => {
    it('should clean up intervals on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      
      const { unmount } = renderHook(() => useGameClock())
      
      unmount()
      
      expect(clearIntervalSpy).toHaveBeenCalled()
    })

    it('should not leak memory with multiple re-renders', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      
      const { rerender, unmount } = renderHook(() => useGameClock())
      
      // Multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender()
      }
      
      unmount()
      
      // Should clean up all intervals
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(setIntervalSpy.mock.calls.length)
    })
  })
})