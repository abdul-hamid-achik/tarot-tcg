import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createInitialGameState, playCard, endTurn } from '@/lib/game_logic'
import type { GameState, GameCard, Card } from '@/schemas/schema'

describe('Bench Card Persistence Tests', () => {
    let gameState: GameState

    beforeEach(() => {
        gameState = createInitialGameState()
    })

    describe('Basic Bench Persistence', () => {
        it('should maintain bench cards across turn transitions', async () => {
            // Use the first card from the hand (which exists in the game state)
            const testCard = gameState.player1.hand[0]

            // Give enough mana to play the card
            gameState.player1.mana = testCard.cost + 1

            // Play card to bench
            const stateAfterPlay = await playCard(gameState, testCard)
            expect(stateAfterPlay.player1.bench).toHaveLength(1)
            expect(stateAfterPlay.player1.bench[0].name).toBe(testCard.name)
            expect(stateAfterPlay.player1.hand).toHaveLength(3) // Should have 3 cards left

            // End turn
            const stateAfterTurn = await endTurn(stateAfterPlay)

            // Bench card should still be there
            expect(stateAfterTurn.player1.bench).toHaveLength(1)
            expect(stateAfterTurn.player1.bench[0].name).toBe(testCard.name)
            expect(stateAfterTurn.player1.bench[0].id).toBe(testCard.id)
        })

        it('should maintain multiple bench cards across multiple turns', async () => {
            // Use the first two cards from the hand
            const testCard1 = gameState.player1.hand[0]
            const testCard2 = gameState.player1.hand[1]

            // Give enough mana to play both cards
            gameState.player1.mana = Math.max(testCard1.cost, testCard2.cost) + 1

            // Play first card
            let currentState = await playCard(gameState, testCard1)
            expect(currentState.player1.bench).toHaveLength(1)

            // Play second card
            currentState = await playCard(currentState, testCard2)
            expect(currentState.player1.bench).toHaveLength(2)

            // End turn
            currentState = await endTurn(currentState)

            // Both bench cards should still be there
            expect(currentState.player1.bench).toHaveLength(2)
            expect(currentState.player1.bench[0].name).toBe(testCard1.name)
            expect(currentState.player1.bench[1].name).toBe(testCard2.name)

            // End another turn
            currentState = await endTurn(currentState)

            // Bench cards should still persist
            expect(currentState.player1.bench).toHaveLength(2)
            expect(currentState.player1.bench[0].name).toBe(testCard1.name)
            expect(currentState.player1.bench[1].name).toBe(testCard2.name)
        })

        it('should not lose bench cards when AI takes turn', async () => {
            // Use the first card from the hand
            const testCard = gameState.player1.hand[0]
            gameState.player1.mana = testCard.cost + 1

            // Play card to bench
            let currentState = await playCard(gameState, testCard)
            expect(currentState.player1.bench).toHaveLength(1)

            // End player1 turn (switches to player2/AI)
            currentState = await endTurn(currentState)
            expect(currentState.activePlayer).toBe('player2')

            // Player1's bench card should still be there
            expect(currentState.player1.bench).toHaveLength(1)
            expect(currentState.player1.bench[0].name).toBe(testCard.name)

            // End player2 turn (switches back to player1)
            currentState = await endTurn(currentState)
            expect(currentState.activePlayer).toBe('player1')

            // Player1's bench card should still be there
            expect(currentState.player1.bench).toHaveLength(1)
            expect(currentState.player1.bench[0].name).toBe(testCard.name)
        })
    })

    describe('State Consistency', () => {
        it('should maintain card properties across state updates', async () => {
            // Use the first card from the hand
            const testCard = gameState.player1.hand[0]
            gameState.player1.mana = testCard.cost + 1

            // Play card
            let currentState = await playCard(gameState, testCard)
            const benchCard = currentState.player1.bench[0]

            // Verify card properties
            expect(benchCard.id).toBe(testCard.id)
            expect(benchCard.name).toBe(testCard.name)
            expect(benchCard.attack).toBe(testCard.attack)
            expect(benchCard.health).toBe(testCard.health)
            expect(benchCard.currentHealth).toBe(testCard.health)
            expect(benchCard.position).toBe('bench')
            expect(benchCard.owner).toBe('player1')

            // End turn
            currentState = await endTurn(currentState)

            // Card properties should be unchanged
            const benchCardAfter = currentState.player1.bench[0]
            expect(benchCardAfter.id).toBe(benchCard.id)
            expect(benchCardAfter.name).toBe(benchCard.name)
            expect(benchCardAfter.attack).toBe(benchCard.attack)
            expect(benchCardAfter.health).toBe(benchCard.health)
            expect(benchCardAfter.currentHealth).toBe(benchCard.currentHealth)
            expect(benchCardAfter.position).toBe(benchCard.position)
            expect(benchCardAfter.owner).toBe(benchCard.owner)
        })

        it('should not duplicate cards during turn transitions', async () => {
            // Use the first card from the hand
            const testCard = gameState.player1.hand[0]
            gameState.player1.mana = testCard.cost + 1

            // Play card
            let currentState = await playCard(gameState, testCard)
            expect(currentState.player1.bench).toHaveLength(1)

            // End turn multiple times
            currentState = await endTurn(currentState)
            currentState = await endTurn(currentState)
            currentState = await endTurn(currentState)

            // Should still have exactly one card on bench
            expect(currentState.player1.bench).toHaveLength(1)
            expect(currentState.player1.bench[0].id).toBe(testCard.id)
        })
    })

    describe('Edge Cases', () => {
        it('should handle empty bench correctly', async () => {
            // Start with empty bench
            expect(gameState.player1.bench).toHaveLength(0)

            // End turn
            let currentState = await endTurn(gameState)

            // Bench should still be empty
            expect(currentState.player1.bench).toHaveLength(0)

            // End another turn
            currentState = await endTurn(currentState)

            // Bench should still be empty
            expect(currentState.player1.bench).toHaveLength(0)
        })

        it('should handle full bench correctly', async () => {
            // Fill the bench with 6 cards (max capacity)
            const benchCards: GameCard[] = Array.from({ length: 6 }, (_, i) => ({
                id: `bench-card-${i}`,
                name: `Bench Card ${i}`,
                cost: 1,
                attack: 1,
                health: 1,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A bench card',
                currentHealth: 1,
                position: 'bench',
                owner: 'player1',
            }))

            gameState.player1.bench.push(...benchCards)
            expect(gameState.player1.bench).toHaveLength(6)

            // End turn
            let currentState = await endTurn(gameState)

            // All 6 bench cards should still be there
            expect(currentState.player1.bench).toHaveLength(6)
            expect(currentState.player1.bench[0].id).toBe('bench-card-0')
            expect(currentState.player1.bench[5].id).toBe('bench-card-5')
        })
    })
})
