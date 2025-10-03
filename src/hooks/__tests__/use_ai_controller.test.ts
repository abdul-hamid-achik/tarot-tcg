import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIController } from '../use_ai_controller'
import { createTestGameState } from '@/test_utils'
import type { GameState } from '@/schemas/schema'

// Mock dependencies
vi.mock('@/store/game_store', () => ({
    useGameStore: vi.fn(),
}))

vi.mock('../use_game_actions', () => ({
    useGameActions: vi.fn(),
}))

vi.mock('@/services/ai_controller_service', () => ({
    aiController: {
        executeAITurn: vi.fn(),
    },
}))

vi.mock('@/lib/game_logger', () => ({
    GameLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        ai: vi.fn(),
    },
}))

describe('useAIController', () => {
    let mockGameState: GameState
    let mockSetGameState: ReturnType<typeof vi.fn>
    let mockEndTurn: ReturnType<typeof vi.fn>
    let mockExecuteAITurn: any

    beforeEach(async () => {
        vi.clearAllMocks()
        vi.useFakeTimers()

        mockGameState = createTestGameState({
            activePlayer: 'player2',
            phase: 'action',
        })

        mockSetGameState = vi.fn()
        mockEndTurn = vi.fn()

        const { useGameStore } = await import('@/store/game_store')
        vi.mocked(useGameStore).mockReturnValue({
            gameState: mockGameState,
            setGameState: mockSetGameState,
        } as any)

        const { useGameActions } = await import('../use_game_actions')
        vi.mocked(useGameActions).mockReturnValue({
            endTurn: mockEndTurn,
        } as any)

        const { aiController } = await import('@/services/ai_controller_service')
        mockExecuteAITurn = vi.mocked(aiController.executeAITurn)
        mockExecuteAITurn.mockResolvedValue(mockGameState)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('Initialization', () => {
        it('should initialize with default options', () => {
            const { result } = renderHook(() => useAIController())

            expect(result.current.executeAI).toBeDefined()
            expect(result.current.triggerAI).toBeDefined()
            expect(result.current.getAIInfo).toBeDefined()
            expect(result.current.resetAI).toBeDefined()
        })

        it('should accept custom difficulty', () => {
            const { result } = renderHook(() =>
                useAIController({ difficulty: 'hard' })
            )

            const info = result.current.getAIInfo()
            expect(info.difficulty).toBe('hard')
        })

        it('should accept enabled option', () => {
            renderHook(() => useAIController({ enabled: false }))

            // Should not trigger auto-play when disabled
            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })

        it('should accept autoPlay option', () => {
            renderHook(() => useAIController({ autoPlay: false }))

            // Should not auto-play even on AI turn
            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })
    })

    describe('Auto-play', () => {
        it('should auto-play on AI turn', async () => {
            renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            await act(async () => {
                vi.advanceTimersByTime(500)
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).toHaveBeenCalledWith(mockGameState)
        })

        it('should not auto-play on player turn', async () => {
            mockGameState.activePlayer = 'player1'

            renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            await act(async () => {
                vi.advanceTimersByTime(1000)
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })

        it('should not auto-play during non-action phase', async () => {
            mockGameState.phase = 'mulligan'

            renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            await act(async () => {
                vi.advanceTimersByTime(1000)
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })

        it('should add delay before auto-play', async () => {
            renderHook(() => useAIController())

            // Before delay
            await act(async () => {
                vi.advanceTimersByTime(400)
                await Promise.resolve()
            })
            expect(mockExecuteAITurn).not.toHaveBeenCalled()

            // After delay
            await act(async () => {
                vi.advanceTimersByTime(200)
                await Promise.resolve()
            })
            expect(mockExecuteAITurn).toHaveBeenCalled()
        })

        it('should cleanup timeout on unmount', () => {
            const { unmount } = renderHook(() => useAIController())

            unmount()

            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })
    })

    describe('executeAI', () => {
        it('should execute AI turn', async () => {
            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                await result.current.executeAI()
            })

            expect(mockExecuteAITurn).toHaveBeenCalledWith(mockGameState)
            expect(mockSetGameState).toHaveBeenCalledWith(mockGameState)
        })

        it('should handle AI execution error', async () => {
            mockExecuteAITurn.mockRejectedValue(new Error('AI failed'))

            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                await result.current.executeAI()
            })

            expect(mockSetGameState).not.toHaveBeenCalled()
        })

        it('should not execute if no game state', async () => {
            const { useGameStore } = await import('@/store/game_store')
            vi.mocked(useGameStore).mockReturnValue({
                gameState: null,
                setGameState: mockSetGameState,
            } as any)

            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                await result.current.executeAI()
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })

        it('should prevent concurrent executions', async () => {
            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            // Start multiple executions
            const promise1 = act(async () => {
                await result.current.executeAI()
            })

            const promise2 = act(async () => {
                await result.current.executeAI()
            })

            await Promise.all([promise1, promise2])

            // Should only execute once due to ref guard
            expect(mockExecuteAITurn).toHaveBeenCalledTimes(1)
        })

        it('should update game state with AI result', async () => {
            const newState = createTestGameState({ activePlayer: 'player1' })
            mockExecuteAITurn.mockResolvedValue(newState)

            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                await result.current.executeAI()
            })

            expect(mockSetGameState).toHaveBeenCalledWith(newState)
        })
    })

    describe('triggerAI', () => {
        it('should trigger AI manually on AI turn', async () => {
            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                result.current.triggerAI()
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).toHaveBeenCalled()
        })

        it('should not trigger AI on player turn', async () => {
            mockGameState.activePlayer = 'player1'

            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                result.current.triggerAI()
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })

        it('should work regardless of phase', async () => {
            mockGameState.phase = 'combat_resolution'

            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            await act(async () => {
                result.current.triggerAI()
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).toHaveBeenCalled()
        })
    })

    describe('getAIInfo', () => {
        it('should return AI info with default difficulty', () => {
            const { result } = renderHook(() => useAIController())

            const info = result.current.getAIInfo()

            expect(info.name).toBe('AI Opponent')
            expect(info.difficulty).toBe('normal')
            expect(info.aggression).toBe(0.5)
            expect(info.icon).toBe('🤖')
        })

        it('should return AI info with custom difficulty', () => {
            const { result } = renderHook(() =>
                useAIController({ difficulty: 'hard' })
            )

            const info = result.current.getAIInfo()

            expect(info.difficulty).toBe('hard')
        })

        it('should return AI info with easy difficulty', () => {
            const { result } = renderHook(() =>
                useAIController({ difficulty: 'easy' })
            )

            const info = result.current.getAIInfo()

            expect(info.difficulty).toBe('easy')
        })
    })

    describe('resetAI', () => {
        it('should call reset without errors', () => {
            const { result } = renderHook(() => useAIController())

            expect(() => {
                result.current.resetAI()
            }).not.toThrow()
        })

        it('should work multiple times', () => {
            const { result } = renderHook(() => useAIController())

            result.current.resetAI()
            result.current.resetAI()
            result.current.resetAI()

            expect(true).toBe(true) // No errors thrown
        })
    })

    describe('Edge Cases', () => {
        it('should handle rapid state changes', async () => {
            const { rerender } = renderHook(() => useAIController())

            // Rapid state changes
            for (let i = 0; i < 5; i++) {
                rerender()
                await act(async () => {
                    vi.advanceTimersByTime(100)
                    await Promise.resolve()
                })
            }

            // Should handle gracefully
            expect(true).toBe(true)
        })

        it('should handle missing game state gracefully', async () => {
            const { useGameStore } = await import('@/store/game_store')
            vi.mocked(useGameStore).mockReturnValue({
                gameState: null,
                setGameState: mockSetGameState,
            } as any)

            const { result } = renderHook(() => useAIController())

            await act(async () => {
                result.current.triggerAI()
                await Promise.resolve()
            })

            // Should not crash
            expect(true).toBe(true)
        })

        it('should handle all difficulty levels', () => {
            const difficulties: Array<'easy' | 'normal' | 'hard'> = ['easy', 'normal', 'hard']

            difficulties.forEach(difficulty => {
                const { result } = renderHook(() => useAIController({ difficulty }))
                const info = result.current.getAIInfo()
                expect(info.difficulty).toBe(difficulty)
            })
        })

        it('should not auto-play when disabled mid-execution', async () => {
            const { rerender } = renderHook(
                ({ enabled }) => useAIController({ enabled }),
                { initialProps: { enabled: true } }
            )

            // Disable before timer fires
            rerender({ enabled: false })

            await act(async () => {
                vi.advanceTimersByTime(1000)
                await Promise.resolve()
            })

            expect(mockExecuteAITurn).not.toHaveBeenCalled()
        })

        it('should handle phase transitions during delay', async () => {
            renderHook(() => useAIController())

            // Change phase during delay
            await act(async () => {
                vi.advanceTimersByTime(250)
                mockGameState.phase = 'combat_resolution'
                vi.advanceTimersByTime(250)
                await Promise.resolve()
            })

            // Should still execute since it was action phase when scheduled
            expect(mockExecuteAITurn).toHaveBeenCalled()
        })

        it('should handle player change during execution', async () => {
            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            // Start execution
            const executionPromise = act(async () => {
                result.current.executeAI()
            })

            // Change player
            mockGameState.activePlayer = 'player1'

            await executionPromise

            // Should complete execution
            expect(mockSetGameState).toHaveBeenCalled()
        })
    })

    describe('isExecuting flag', () => {
        it('should initially be false', () => {
            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            expect(result.current.isExecuting).toBe(false)
        })

        it('should prevent execution when already executing', async () => {
            mockExecuteAITurn.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve(mockGameState), 1000))
            )

            const { result } = renderHook(() => useAIController({ autoPlay: false }))

            // Start first execution
            act(() => {
                result.current.executeAI()
            })

            // Try second execution
            await act(async () => {
                await result.current.executeAI()
            })

            // Should only call once (second blocked by ref)
            expect(mockExecuteAITurn).toHaveBeenCalledTimes(1)
        })
    })
})

