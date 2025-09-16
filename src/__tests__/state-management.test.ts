import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createInitialGameState } from '@/lib/game_logic'
import { playCard, endTurn } from '@/lib/game_logic'
import { StateManager } from '@/services/state_manager'
import type { GameState, GameCard } from '@/schemas/schema'

describe('State Management Tests', () => {
    let gameState: GameState
    let stateManager: StateManager

    beforeEach(() => {
        gameState = createInitialGameState()
        stateManager = new StateManager()
        stateManager.initialize(gameState)

        // Clear any existing console spies
        vi.clearAllMocks()
    })

    describe('Bench Card Persistence', () => {
        it('should maintain bench cards across turn transitions', async () => {
            // Use the first card from the hand
            const testCard = gameState.player1.hand[0]
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
            // Create multiple test cards
            const testCards: GameCard[] = [
                {
                    id: 'test-unit-1',
                    name: 'Test Unit 1',
                    cost: 1,
                    attack: 1,
                    health: 2,
                    type: 'unit',
                    zodiacClass: 'aries',
                    element: 'fire',
                    rarity: 'common',
                    description: 'A test unit',
                    currentHealth: 2,
                    position: 'hand',
                    owner: 'player1',
                },
                {
                    id: 'test-unit-2',
                    name: 'Test Unit 2',
                    cost: 2,
                    attack: 2,
                    health: 3,
                    type: 'unit',
                    zodiacClass: 'taurus',
                    element: 'earth',
                    rarity: 'common',
                    description: 'Another test unit',
                    currentHealth: 3,
                    position: 'hand',
                    owner: 'player1',
                }
            ]

            // Add cards to hand and give enough mana
            gameState.player1.hand.push(...testCards)
            gameState.player1.mana = 5

            // Play first card
            let currentState = await playCard(gameState, testCards[0])
            expect(currentState.player1.bench).toHaveLength(1)

            // Play second card
            currentState = await playCard(currentState, testCards[1])
            expect(currentState.player1.bench).toHaveLength(2)

            // End turn
            currentState = await endTurn(currentState)

            // Both bench cards should still be there
            expect(currentState.player1.bench).toHaveLength(2)
            expect(currentState.player1.bench[0].name).toBe('Test Unit 1')
            expect(currentState.player1.bench[1].name).toBe('Test Unit 2')

            // End another turn
            currentState = await endTurn(currentState)

            // Bench cards should still persist
            expect(currentState.player1.bench).toHaveLength(2)
            expect(currentState.player1.bench[0].name).toBe('Test Unit 1')
            expect(currentState.player1.bench[1].name).toBe('Test Unit 2')
        })

        it('should not lose bench cards when AI takes turn', async () => {
            // Create a test card and play it
            const testCard: GameCard = {
                id: 'test-unit-1',
                name: 'Test Unit',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A test unit',
                currentHealth: 3,
                position: 'hand',
                owner: 'player1',
            }

            gameState.player1.hand.push(testCard)
            gameState.player1.mana = 3

            // Play card to bench
            let currentState = await playCard(gameState, testCard)
            expect(currentState.player1.bench).toHaveLength(1)

            // End player1 turn (switches to player2/AI)
            currentState = await endTurn(currentState)
            expect(currentState.activePlayer).toBe('player2')

            // Player1's bench card should still be there
            expect(currentState.player1.bench).toHaveLength(1)
            expect(currentState.player1.bench[0].name).toBe('Test Unit')

            // End player2 turn (switches back to player1)
            currentState = await endTurn(currentState)
            expect(currentState.activePlayer).toBe('player1')

            // Player1's bench card should still be there
            expect(currentState.player1.bench).toHaveLength(1)
            expect(currentState.player1.bench[0].name).toBe('Test Unit')
        })
    })

    describe('State Manager Initialization', () => {
        it('should not reinitialize StateManager unnecessarily', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

            // Initialize once
            stateManager.initialize(gameState)

            // Clear the spy to count only new calls
            consoleSpy.mockClear()

            // Initialize again with same state
            stateManager.initialize(gameState)

            // Should not log "StateManager initialized" again
            const initCalls = consoleSpy.mock.calls.filter(call =>
                call[0]?.includes?.('StateManager initialized')
            )
            expect(initCalls).toHaveLength(0)

            consoleSpy.mockRestore()
        })

        it('should track StateManager initialization frequency', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

            // Initialize multiple times
            stateManager.initialize(gameState)
            stateManager.initialize(gameState)
            stateManager.initialize(gameState)

            // Count initialization calls
            const initCalls = consoleSpy.mock.calls.filter(call =>
                call[0]?.includes?.('StateManager initialized')
            )

            // Should only initialize once per unique state
            expect(initCalls.length).toBeLessThanOrEqual(1)

            consoleSpy.mockRestore()
        })
    })

    describe('Turn Transition Integrity', () => {
        it('should maintain all game state during turn transitions', async () => {
            // Use the first card from the hand
            const testCard = gameState.player1.hand[0]
            gameState.player1.mana = testCard.cost + 1
            // Don't set spellMana - let it be 0 initially

            // Play card
            let currentState = await playCard(gameState, testCard)

            // Record state before turn end
            const benchBefore = [...currentState.player1.bench]
            const handBefore = [...currentState.player1.hand]
            const manaBefore = currentState.player1.mana
            const spellManaBefore = currentState.player1.spellMana
            const deckBefore = [...currentState.player1.deck]

            // End turn
            currentState = await endTurn(currentState)

            // Verify all state is preserved (except mana which should be refilled)
            expect(currentState.player1.bench).toEqual(benchBefore)
            expect(currentState.player1.hand).toEqual(handBefore)
            expect(currentState.player1.deck).toEqual(deckBefore)

            // Mana should be refilled for the new turn (should be at least 1)
            expect(currentState.player1.mana).toBeGreaterThanOrEqual(1)
            // Spell mana should be increased by unspent mana (this is how the game works)
            expect(currentState.player1.spellMana).toBeGreaterThanOrEqual(spellManaBefore)
        })

        it('should not duplicate cards during turn transitions', async () => {
            // Create a test card
            const testCard: GameCard = {
                id: 'test-unit-1',
                name: 'Test Unit',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A test unit',
                currentHealth: 3,
                position: 'hand',
                owner: 'player1',
            }

            gameState.player1.hand.push(testCard)
            gameState.player1.mana = 3

            // Play card
            let currentState = await playCard(gameState, testCard)
            expect(currentState.player1.bench).toHaveLength(1)

            // End turn multiple times
            currentState = await endTurn(currentState)
            currentState = await endTurn(currentState)
            currentState = await endTurn(currentState)

            // Should still have exactly one card on bench
            expect(currentState.player1.bench).toHaveLength(1)
            expect(currentState.player1.bench[0].id).toBe('test-unit-1')
        })
    })

    describe('Card State Consistency', () => {
        it('should maintain card properties across state updates', async () => {
            const testCard: GameCard = {
                id: 'test-unit-1',
                name: 'Test Unit',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A test unit',
                currentHealth: 3,
                position: 'hand',
                owner: 'player1',
            }

            gameState.player1.hand.push(testCard)
            gameState.player1.mana = 3

            // Play card
            let currentState = await playCard(gameState, testCard)
            const benchCard = currentState.player1.bench[0]

            // Verify card properties
            expect(benchCard.id).toBe('test-unit-1')
            expect(benchCard.name).toBe('Test Unit')
            expect(benchCard.attack).toBe(2)
            expect(benchCard.health).toBe(3)
            expect(benchCard.currentHealth).toBe(3)
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
    })
})
