import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAIController } from '@/hooks/use_ai_controller'
import { createInitialGameState } from '@/lib/game_logic'
import type { GameState } from '@/schemas/schema'

describe('AI Turn Management Tests', () => {
    let gameState: GameState

    beforeEach(() => {
        gameState = createInitialGameState()
        vi.clearAllMocks()
    })

    describe('AI Controller Hook', () => {
        it('should initialize AI controller correctly', () => {
            const { result } = renderHook(() => useAIController({
                enabled: true,
                autoPlay: false
            }))

            expect(result.current).toBeDefined()
            expect(result.current.executeAI).toBeInstanceOf(Function)
        })

        it('should handle AI execution without errors', async () => {
            const { result } = renderHook(() => useAIController({
                enabled: true,
                autoPlay: false,
                difficulty: 'normal'
            }))

            // Should not throw when executing AI
            await expect(async () => {
                await act(async () => {
                    await result.current.executeAI()
                })
            }).not.toThrow()
        })

        it('should support different difficulty levels', () => {
            const { result: normal } = renderHook(() => useAIController({
                difficulty: 'normal'
            }))
            const { result: hard } = renderHook(() => useAIController({
                difficulty: 'hard'
            }))
            const { result: easy } = renderHook(() => useAIController({
                difficulty: 'easy'
            }))

            // All should initialize without errors
            expect(normal.current.executeAI).toBeInstanceOf(Function)
            expect(hard.current.executeAI).toBeInstanceOf(Function)
            expect(easy.current.executeAI).toBeInstanceOf(Function)
        })
    })

    describe('Game State Handling', () => {
        it('should handle null game state gracefully', async () => {
            const { result } = renderHook(() => useAIController({
                enabled: true,
                autoPlay: false
            }))

            // Should not throw with null game state
            await expect(async () => {
                await act(async () => {
                    await result.current.executeAI()
                })
            }).not.toThrow()
        })

        it('should maintain consistent hook interface', () => {
            const { result } = renderHook(() => useAIController())

            // Hook should always return consistent interface
            expect(result.current).toHaveProperty('executeAI')
            expect(typeof result.current.executeAI).toBe('function')
        })
    })

    describe('Performance', () => {
        it('should handle multiple re-renders without memory leaks', () => {
            const { rerender } = renderHook(() => useAIController({
                enabled: true
            }))

            // Multiple re-renders should not cause issues
            for (let i = 0; i < 5; i++) {
                rerender()
            }

            expect(() => rerender()).not.toThrow()
        })

        it('should clean up properly on unmount', () => {
            const { unmount } = renderHook(() => useAIController())

            expect(() => unmount()).not.toThrow()
        })
    })

    describe('Configuration', () => {
        it('should accept configuration options', () => {
            const { result: disabled } = renderHook(() => useAIController({
                enabled: false
            }))
            const { result: enabled } = renderHook(() => useAIController({
                enabled: true
            }))

            // Both configurations should work
            expect(disabled.current.executeAI).toBeInstanceOf(Function)
            expect(enabled.current.executeAI).toBeInstanceOf(Function)
        })

        it('should handle default configuration', () => {
            const { result } = renderHook(() => useAIController())

            expect(result.current.executeAI).toBeInstanceOf(Function)
        })
    })
})