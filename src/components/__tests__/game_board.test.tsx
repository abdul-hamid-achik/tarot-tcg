import { describe, it, expect, beforeEach } from 'vitest'
import { produce } from 'immer'
import { createInitialGameState, endTurn, playCard } from '@/lib/game_logic'
import type { GameState, Card } from '@/schemas/schema'

/**
 * Integration tests for GameBoard behavior
 * Tests state immutability and function stability through game logic
 */

describe('GameBoard Integration - State Management', () => {
    let gameState: GameState
    let testCard: Card

    beforeEach(() => {
        const deck = [
            {
                id: 'test-card-1',
                name: 'Test Card',
                type: 'unit' as const,
                cost: 3,
                attack: 2,
                health: 3,
                description: 'Test',
                reversedDescription: 'Reversed',
                keywords: [],
                element: 'fire' as const,
                zodiacSign: 'aries' as const,
            },
        ]

        const initialState = createInitialGameState({
            player1Deck: deck,
            player2Deck: deck,
        })

        // Skip mulligan phase and give player sufficient mana for testing
        gameState = produce(initialState, draft => {
            draft.phase = 'action'
            draft.player1.mana = 10 // Ensure enough mana for testing multiple card plays
        })

        testCard = gameState.player1.hand[0]
    })

    describe('State Immutability on Play', () => {
        it('should not mutate original state when playing a card', async () => {
            const originalState = gameState
            const originalHandLength = gameState.player1.hand.length
            const originalBattlefield = gameState.battlefield.playerUnits

            await playCard(gameState, testCard, 0)

            // Original state should remain unchanged
            expect(gameState.player1.hand).toHaveLength(originalHandLength)
            expect(gameState.battlefield.playerUnits).toBe(originalBattlefield)
        })

        it('should return new state object when playing a card', async () => {
            const originalState = gameState
            const newState = await playCard(gameState, testCard, 0)

            // Should be different object
            expect(newState).not.toBe(originalState)
            expect(newState.battlefield).not.toBe(originalState.battlefield)
            expect(newState.player1.hand).not.toBe(originalState.player1.hand)
        })
    })

    describe('State Immutability on End Turn', () => {
        it('should not mutate original state when ending turn', async () => {
            const originalState = gameState
            const originalActivePlayer = gameState.activePlayer
            const originalBattlefield = gameState.battlefield

            await endTurn(gameState)

            // Original state should remain unchanged
            expect(gameState.activePlayer).toBe(originalActivePlayer)
            expect(gameState.battlefield).toBe(originalBattlefield)
        })

        it('should handle multiple sequential endTurn calls without state corruption', async () => {
            let currentState = gameState

            // Play a card first
            currentState = await playCard(currentState, testCard, 0)
            const placedCard = currentState.battlefield.playerUnits[0]
            expect(placedCard).not.toBeNull()

            // Multiple end turns
            for (let i = 0; i < 4; i++) {
                currentState = await endTurn(currentState)
            }

            // Card should still be on battlefield after multiple turns
            const stillPlacedCard = currentState.battlefield.playerUnits[0]
            expect(stillPlacedCard).not.toBeNull()
            expect(stillPlacedCard?.id).toBe(placedCard?.id)
        })

        it('should maintain battlefield integrity across turns', async () => {
            // Play cards
            let currentState = await playCard(gameState, testCard, 0)
            const card1 = currentState.player1.hand[0]
            if (card1) {
                currentState = await playCard(currentState, card1, 1)
            }

            // Verify cards placed
            expect(currentState.battlefield.playerUnits[0]).not.toBeNull()
            expect(currentState.battlefield.playerUnits[1]).not.toBeNull()

            // End turn multiple times
            currentState = await endTurn(currentState) // P1 -> P2
            currentState = await endTurn(currentState) // P2 -> P1

            // Cards should still be there
            expect(currentState.battlefield.playerUnits[0]).not.toBeNull()
            expect(currentState.battlefield.playerUnits[1]).not.toBeNull()
        })
    })

    describe('Reversed Card Orientation', () => {
        it('should maintain isReversed property through play and end turn', async () => {
            // Find a reversed card or set one
            const card = gameState.player1.hand.find(c => c.isReversed) ||
                { ...gameState.player1.hand[0], isReversed: true }

            let currentState = gameState
            if (card.isReversed) {
                currentState = await playCard(gameState, card, 0)
                const placedCard = currentState.battlefield.playerUnits[0]
                expect(placedCard?.isReversed).toBe(true)

                // End turn and check it's still reversed
                currentState = await endTurn(currentState)
                const stillReversed = currentState.battlefield.playerUnits[0]
                expect(stillReversed?.isReversed).toBe(true)
            }
        })
    })

    describe('Component Behavior Simulation', () => {
        it('should handle rapid state transitions without losing data', async () => {
            let currentState = gameState

            // Simulate rapid game actions (like Fast Refresh)
            const actions = [
                () => playCard(currentState, testCard, 0),
                () => endTurn(currentState),
                () => endTurn(currentState),
            ]

            for (const action of actions) {
                currentState = await action()
            }

            // State should be consistent
            expect(currentState).toBeDefined()
            expect(currentState.battlefield).toBeDefined()
            expect(currentState.player1).toBeDefined()
            expect(currentState.player2).toBeDefined()
        })

        it('should maintain independent state copies', async () => {
            const state1 = gameState
            const state2 = await playCard(gameState, testCard, 0)
            const state3 = await endTurn(state2)

            // All states should be independent
            expect(state1.battlefield.playerUnits[0]).toBeNull()
            expect(state2.battlefield.playerUnits[0]).not.toBeNull()
            expect(state3.battlefield.playerUnits[0]).not.toBeNull()

            // Modifying one should not affect others
            expect(state1).not.toBe(state2)
            expect(state2).not.toBe(state3)
        })
    })
})

