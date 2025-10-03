import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameClock } from '../use_game_clock'
import { useGameStore } from '@/store/game_store'
import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

// Mock dependencies
vi.mock('@/store/game_store')
vi.mock('@/lib/game_logger')

describe('useGameClock', () => {
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

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock useGameStore
        vi.mocked(useGameStore).mockReturnValue({
            gameState: mockGameState,
        } as any)

        // Mock GameLogger
        vi.mocked(GameLogger.debug).mockImplementation(() => { })
    })

    describe('Initialization', () => {
        it('should initialize with default config', () => {
            const { result } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)
            expect(result.current.matchTime).toBe(0)
            expect(result.current.isWarning).toBe(false)
            expect(result.current.isTimerExpired).toBe(false)
        })

        it('should initialize with custom turn time limit', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 60 }))

            expect(result.current.timeRemaining).toBe(60)
        })

        it('should initialize with custom warning time', () => {
            const { result } = renderHook(() => useGameClock({ warningTime: 10 }))

            expect(result.current.isWarning).toBe(false)
            expect(result.current.timeRemaining).toBe(90)
        })

        it('should initialize with autoEndTurn disabled', () => {
            const { result } = renderHook(() => useGameClock({ autoEndTurn: false }))

            expect(result.current.timeRemaining).toBe(90)
        })

        it('should initialize with multiple custom options', () => {
            const { result } = renderHook(() =>
                useGameClock({ turnTimeLimit: 45, warningTime: 5, autoEndTurn: false }),
            )

            expect(result.current.timeRemaining).toBe(45)
        })
    })

    describe('Turn Timer State Management', () => {
        it('should reset turn timer when turn changes', () => {
            const { result, rerender } = renderHook(() => useGameClock({ turnTimeLimit: 60 }))

            expect(result.current.timeRemaining).toBe(60)

            // Change turn
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, turn: 2 },
            } as any)

            rerender()

            // Should reset to full time
            expect(result.current.timeRemaining).toBe(60)
            expect(result.current.isWarning).toBe(false)
        })

        it('should handle rapid turn changes', () => {
            const { result, rerender } = renderHook(() => useGameClock({ turnTimeLimit: 30 }))

            // Rapidly change turns
            for (let i = 2; i <= 5; i++) {
                vi.mocked(useGameStore).mockReturnValue({
                    gameState: { ...mockGameState, turn: i },
                } as any)
                rerender()
            }

            // Should still have reset time
            expect(result.current.timeRemaining).toBe(30)
            expect(result.current.isWarning).toBe(false)
        })

        it('should reset when activePlayer changes', () => {
            const { result, rerender } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)

            // Switch to player2
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, activePlayer: 'player2' },
            } as any)

            rerender()

            expect(result.current.timeRemaining).toBe(90)
            expect(result.current.isWarning).toBe(false)
        })

        it('should reset when phase changes', () => {
            const { result, rerender } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)

            // Switch to combat phase
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, phase: 'combat' },
            } as any)

            rerender()

            expect(result.current.timeRemaining).toBe(90)
        })
    })

    describe('Time Formatting', () => {
        it('should format turn time correctly (minutes:seconds)', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 90 }))

            expect(result.current.getTurnTime()).toBe('1:30')
        })

        it('should pad single digit seconds', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 65 }))

            expect(result.current.getTurnTime()).toBe('1:05')
        })

        it('should format zero time correctly', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 0 }))

            expect(result.current.getTurnTime()).toBe('0:00')
            expect(result.current.isTimerExpired).toBe(true)
        })

        it('should format short times correctly', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 15 }))

            expect(result.current.getTurnTime()).toBe('0:15')
        })

        it('should format long times correctly (over an hour)', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 3665 }))

            expect(result.current.getTurnTime()).toBe('61:05')
        })

        it('should format match time independently', () => {
            const { result } = renderHook(() => useGameClock())

            // Match time starts at 0
            expect(result.current.getMatchTime()).toBe('0:00')
        })
    })

    describe('Manual Timer Reset', () => {
        it('should provide resetTurnTimer function', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 60 }))

            expect(result.current.resetTurnTimer).toBeDefined()
            expect(typeof result.current.resetTurnTimer).toBe('function')
        })

        it('should reset to configured time limit', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 45 }))

            // Call reset
            result.current.resetTurnTimer()

            expect(result.current.timeRemaining).toBe(45)
            expect(result.current.isWarning).toBe(false)
        })
    })

    describe('Return Values', () => {
        it('should return all expected values', () => {
            const { result } = renderHook(() => useGameClock())

            expect(result.current).toHaveProperty('timeRemaining')
            expect(result.current).toHaveProperty('matchTime')
            expect(result.current).toHaveProperty('isWarning')
            expect(result.current).toHaveProperty('getTurnTime')
            expect(result.current).toHaveProperty('getMatchTime')
            expect(result.current).toHaveProperty('resetTurnTimer')
            expect(result.current).toHaveProperty('isTimerExpired')
        })

        it('should correctly calculate isTimerExpired', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 0 }))

            expect(result.current.isTimerExpired).toBe(true)
        })

        it('should return false for isTimerExpired when time remains', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 10 }))

            expect(result.current.isTimerExpired).toBe(false)
        })
    })

    describe('Edge Cases', () => {
        it('should handle null game state', () => {
            vi.mocked(useGameStore).mockReturnValue({
                gameState: null,
            } as any)

            const { result } = renderHook(() => useGameClock())

            // Should still initialize
            expect(result.current.timeRemaining).toBe(90)
            expect(result.current.matchTime).toBe(0)
        })

        it('should handle undefined phase', () => {
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, phase: undefined },
            } as any)

            const { result } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)
        })

        it('should handle undefined activePlayer', () => {
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, activePlayer: undefined },
            } as any)

            const { result } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)
        })

        it('should handle very short turn time limits', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 1 }))

            expect(result.current.timeRemaining).toBe(1)
            expect(result.current.getTurnTime()).toBe('0:01')
        })

        it('should handle very long turn time limits', () => {
            const { result } = renderHook(() => useGameClock({ turnTimeLimit: 3600 })) // 1 hour

            expect(result.current.timeRemaining).toBe(3600)
            expect(result.current.getTurnTime()).toBe('60:00')
        })

        it('should cleanup timers on unmount', () => {
            const { unmount } = renderHook(() => useGameClock())

            const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

            unmount()

            expect(clearIntervalSpy).toHaveBeenCalled()
        })
    })

    describe('Configuration Merging', () => {
        it('should merge partial config with defaults', () => {
            const { result } = renderHook(() => useGameClock({ warningTime: 20 }))

            // Custom warningTime, default turnTimeLimit
            expect(result.current.timeRemaining).toBe(90)
        })

        it('should use all custom values when provided', () => {
            const { result } = renderHook(() =>
                useGameClock({
                    turnTimeLimit: 120,
                    warningTime: 30,
                    autoEndTurn: false,
                }),
            )

            expect(result.current.timeRemaining).toBe(120)
        })

        it('should handle empty config object', () => {
            const { result } = renderHook(() => useGameClock({}))

            expect(result.current.timeRemaining).toBe(90)
        })
    })

    describe('Player-Specific Behavior', () => {
        it('should initialize correctly for player1 action phase', () => {
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, activePlayer: 'player1', phase: 'action' },
            } as any)

            const { result } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)
        })

        it('should initialize correctly for player2 turn', () => {
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, activePlayer: 'player2' },
            } as any)

            const { result } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)
        })

        it('should initialize correctly during non-action phase', () => {
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, phase: 'combat' },
            } as any)

            const { result } = renderHook(() => useGameClock())

            expect(result.current.timeRemaining).toBe(90)
        })
    })

    describe('Callback Stability', () => {
        it('should return stable callback functions', () => {
            const { result, rerender } = renderHook(() => useGameClock())

            const firstGetTurnTime = result.current.getTurnTime
            const firstGetMatchTime = result.current.getMatchTime
            const firstResetTimer = result.current.resetTurnTimer

            rerender()

            // Callbacks should be stable (memoized)
            expect(result.current.getTurnTime).toBe(firstGetTurnTime)
            expect(result.current.getMatchTime).toBe(firstGetMatchTime)
            expect(result.current.resetTurnTimer).toBe(firstResetTimer)
        })
    })

    describe('Integration Scenarios', () => {
        it('should handle complete turn cycle', () => {
            const { result, rerender } = renderHook(() => useGameClock({ turnTimeLimit: 30 }))

            // Initial: Player1 action phase
            expect(result.current.timeRemaining).toBe(30)

            // Switch to Player2
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, activePlayer: 'player2', turn: 2 },
            } as any)

            rerender()

            expect(result.current.timeRemaining).toBe(30)

            // Switch back to Player1
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, activePlayer: 'player1', turn: 3 },
            } as any)

            rerender()

            expect(result.current.timeRemaining).toBe(30)
        })

        it('should handle multiple phase transitions', () => {
            const phases: Array<'action' | 'combat' | 'mulligan'> = ['action', 'combat', 'action']
            const { result, rerender } = renderHook(() => useGameClock())

            for (const phase of phases) {
                vi.mocked(useGameStore).mockReturnValue({
                    gameState: { ...mockGameState, phase },
                } as any)

                rerender()

                expect(result.current.timeRemaining).toBe(90)
            }
        })
    })

    describe('Concurrent Operations', () => {
        it('should handle state changes while timers are active', () => {
            const { result, rerender } = renderHook(() => useGameClock())

            // Change state while timers are running
            vi.mocked(useGameStore).mockReturnValue({
                gameState: { ...mockGameState, turn: 2 },
            } as any)

            rerender()

            // Should not throw or cause errors
            expect(result.current.timeRemaining).toBeDefined()
            expect(result.current.matchTime).toBeDefined()
        })

        it('should handle multiple rapid state changes', () => {
            const { result, rerender } = renderHook(() => useGameClock())

            // Rapidly change multiple properties
            const changes = [
                { ...mockGameState, turn: 2 },
                { ...mockGameState, activePlayer: 'player2' as const },
                { ...mockGameState, phase: 'combat' as const },
                { ...mockGameState, turn: 3, activePlayer: 'player1' as const },
            ]

            for (const state of changes) {
                vi.mocked(useGameStore).mockReturnValue({
                    gameState: state,
                } as any)
                rerender()
            }

            // Should handle all changes gracefully
            expect(result.current.timeRemaining).toBeDefined()
            expect(result.current.isWarning).toBeDefined()
        })
    })
})
