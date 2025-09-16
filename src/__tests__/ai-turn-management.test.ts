import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAIController } from '@/hooks/use_ai_controller'
import { createInitialGameState } from '@/lib/game_logic'
import { playCard } from '@/lib/game_logic'
import type { GameState, GameCard } from '@/schemas/schema'

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

// Mock the game actions
vi.mock('@/hooks/use_game_actions', () => ({
    useGameActions: vi.fn(() => ({
        endTurn: vi.fn(),
        resolveCombat: vi.fn(),
    }))
}))

describe('AI Turn Management Tests', () => {
    let mockSetGameState: ReturnType<typeof vi.fn>
    let gameState: GameState

    beforeEach(() => {
        mockSetGameState = vi.fn()

        // Mock the useGameStore to return our mock
        const { useGameStore } = require('@/store/game_store')
        useGameStore.mockReturnValue({
            gameState: null,
            setGameState: mockSetGameState,
            ui: {
                showCardDetail: vi.fn(),
                hideCardDetail: vi.fn(),
            },
            interaction: {
                selectedCard: null,
                setSelectedCard: vi.fn(),
            },
        })

        gameState = createInitialGameState()
        vi.clearAllMocks()
    })

    describe('State Update Frequency', () => {
        it('should not call setGameState excessively during AI turns', async () => {
            const { result } = renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            // Set up a game state where it's AI's turn
            gameState.activePlayer = 'player2'
            gameState.phase = 'action'

            // Add a card to AI's hand
            const aiCard: GameCard = {
                id: 'ai-card-1',
                name: 'AI Card',
                cost: 1,
                attack: 1,
                health: 2,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'An AI card',
                currentHealth: 2,
                position: 'hand',
                owner: 'player2',
            }
            gameState.player2.hand.push(aiCard)
            gameState.player2.mana = 2

            // Update the mock to return our game state
            const { useGameStore } = require('@/store/game_store')
            useGameStore.mockReturnValue({
                gameState,
                setGameState: mockSetGameState,
                ui: {
                    showCardDetail: vi.fn(),
                    hideCardDetail: vi.fn(),
                },
                interaction: {
                    selectedCard: null,
                    setSelectedCard: vi.fn(),
                },
            })

            // Trigger AI execution
            await act(async () => {
                await result.current.executeAITurn()
            })

            // Should not call setGameState more than a reasonable number of times
            // (once for AI actions, once for turn end)
            expect(mockSetGameState).toHaveBeenCalledTimes(2)
        })

        it('should not cause state resets during AI turn execution', async () => {
            const { result } = renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            // Set up a game state with existing bench cards
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            const existingBenchCard: GameCard = {
                id: 'existing-bench-card',
                name: 'Existing Bench Card',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'taurus',
                element: 'earth',
                rarity: 'common',
                description: 'An existing bench card',
                currentHealth: 3,
                position: 'bench',
                owner: 'player1',
            }
            gameState.player1.bench.push(existingBenchCard)

            // Update the mock to return our game state
            const { useGameStore } = require('@/store/game_store')
            useGameStore.mockReturnValue({
                gameState,
                setGameState: mockSetGameState,
                ui: {
                    showCardDetail: vi.fn(),
                    hideCardDetail: vi.fn(),
                },
                interaction: {
                    selectedCard: null,
                    setSelectedCard: vi.fn(),
                },
            })

            // Trigger AI execution
            await act(async () => {
                await result.current.executeAITurn()
            })

            // Check that setGameState was called with a state that preserves bench cards
            const setGameStateCalls = mockSetGameState.mock.calls
            expect(setGameStateCalls.length).toBeGreaterThan(0)

            // The last call should preserve the existing bench card
            const lastStateUpdate = setGameStateCalls[setGameStateCalls.length - 1][0]
            expect(lastStateUpdate.player1.bench).toContainEqual(
                expect.objectContaining({ id: 'existing-bench-card' })
            )
        })
    })

    describe('Turn Transition Integrity', () => {
        it('should not lose player1 bench cards when AI takes turn', async () => {
            const { result } = renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            // Set up a game state where player1 has bench cards
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            const player1BenchCard: GameCard = {
                id: 'player1-bench-card',
                name: 'Player1 Bench Card',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'gemini',
                element: 'air',
                rarity: 'common',
                description: 'A player1 bench card',
                currentHealth: 3,
                position: 'bench',
                owner: 'player1',
            }
            gameState.player1.bench.push(player1BenchCard)

            // Add AI card for AI to play
            const aiCard: GameCard = {
                id: 'ai-card-1',
                name: 'AI Card',
                cost: 1,
                attack: 1,
                health: 2,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'An AI card',
                currentHealth: 2,
                position: 'hand',
                owner: 'player2',
            }
            gameState.player2.hand.push(aiCard)
            gameState.player2.mana = 2

            // Update the mock to return our game state
            const { useGameStore } = require('@/store/game_store')
            useGameStore.mockReturnValue({
                gameState,
                setGameState: mockSetGameState,
                ui: {
                    showCardDetail: vi.fn(),
                    hideCardDetail: vi.fn(),
                },
                interaction: {
                    selectedCard: null,
                    setSelectedCard: vi.fn(),
                },
            })

            // Trigger AI execution
            await act(async () => {
                await result.current.executeAITurn()
            })

            // Check that player1's bench card is preserved in all state updates
            const setGameStateCalls = mockSetGameState.mock.calls
            for (const call of setGameStateCalls) {
                const state = call[0]
                expect(state.player1.bench).toContainEqual(
                    expect.objectContaining({ id: 'player1-bench-card' })
                )
            }
        })

        it('should maintain card counts correctly during AI turns', async () => {
            const { result } = renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            // Set up a game state with known card counts
            gameState.activePlayer = 'player2'
            gameState.phase = 'action'

            const initialPlayer1HandCount = gameState.player1.hand.length
            const initialPlayer1BenchCount = gameState.player1.bench.length
            const initialPlayer1DeckCount = gameState.player1.deck.length
            const initialPlayer2HandCount = gameState.player2.hand.length
            const initialPlayer2BenchCount = gameState.player2.bench.length
            const initialPlayer2DeckCount = gameState.player2.deck.length

            // Add AI card for AI to play
            const aiCard: GameCard = {
                id: 'ai-card-1',
                name: 'AI Card',
                cost: 1,
                attack: 1,
                health: 2,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'An AI card',
                currentHealth: 2,
                position: 'hand',
                owner: 'player2',
            }
            gameState.player2.hand.push(aiCard)
            gameState.player2.mana = 2

            // Update the mock to return our game state
            const { useGameStore } = require('@/store/game_store')
            useGameStore.mockReturnValue({
                gameState,
                setGameState: mockSetGameState,
                ui: {
                    showCardDetail: vi.fn(),
                    hideCardDetail: vi.fn(),
                },
                interaction: {
                    selectedCard: null,
                    setSelectedCard: vi.fn(),
                },
            })

            // Trigger AI execution
            await act(async () => {
                await result.current.executeAITurn()
            })

            // Check that card counts are reasonable
            const setGameStateCalls = mockSetGameState.mock.calls
            const lastStateUpdate = setGameStateCalls[setGameStateCalls.length - 1][0]

            // Player1's cards should be unchanged
            expect(lastStateUpdate.player1.hand.length).toBe(initialPlayer1HandCount)
            expect(lastStateUpdate.player1.bench.length).toBe(initialPlayer1BenchCount)
            expect(lastStateUpdate.player1.deck.length).toBe(initialPlayer1DeckCount)

            // Player2 should have played a card (hand -1, bench +1)
            expect(lastStateUpdate.player2.hand.length).toBe(initialPlayer2HandCount - 1)
            expect(lastStateUpdate.player2.bench.length).toBe(initialPlayer2BenchCount + 1)
            expect(lastStateUpdate.player2.deck.length).toBe(initialPlayer2DeckCount)
        })
    })

    describe('State Manager Integration', () => {
        it('should not cause excessive StateManager initializations', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

            const { result } = renderHook(() => useAIController({ enabled: true, autoPlay: true }))

            // Set up a game state
            gameState.activePlayer = 'player2'
            gameState.phase = 'action'

            const aiCard: GameCard = {
                id: 'ai-card-1',
                name: 'AI Card',
                cost: 1,
                attack: 1,
                health: 2,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'An AI card',
                currentHealth: 2,
                position: 'hand',
                owner: 'player2',
            }
            gameState.player2.hand.push(aiCard)
            gameState.player2.mana = 2

            // Update the mock to return our game state
            const { useGameStore } = require('@/store/game_store')
            useGameStore.mockReturnValue({
                gameState,
                setGameState: mockSetGameState,
                ui: {
                    showCardDetail: vi.fn(),
                    hideCardDetail: vi.fn(),
                },
                interaction: {
                    selectedCard: null,
                    setSelectedCard: vi.fn(),
                },
            })

            // Clear console spy before AI execution
            consoleSpy.mockClear()

            // Trigger AI execution
            await act(async () => {
                await result.current.executeAITurn()
            })

            // Count StateManager initialization calls
            const initCalls = consoleSpy.mock.calls.filter(call =>
                call[0]?.includes?.('StateManager initialized')
            )

            // Should not have excessive StateManager initializations
            expect(initCalls.length).toBeLessThanOrEqual(2) // Allow for reasonable initialization

            consoleSpy.mockRestore()
        })
    })
})
