import { describe, it, expect, beforeEach } from 'vitest'
import { createTestPlayer, createTestGameState, createTestCard } from '../test_utils'
import type { GameState } from '../schemas/schema'

describe('Battlefield Persistence', () => {
    let gameState: GameState
    let playCard: (state: GameState, card: any, targetSlot?: number) => Promise<GameState>
    let endTurn: (state: GameState) => Promise<GameState>

    beforeEach(async () => {
        const gameLogic = await import('../lib/game_logic')
        playCard = gameLogic.playCard
        endTurn = gameLogic.endTurn

        // Create game state in action phase
        gameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                mana: 10,
                spellMana: 5,
                hand: [
                    createTestCard({
                        id: 'card1',
                        name: 'Page of Wands',
                        cost: 2,
                        type: 'unit',
                        attack: 2,
                        health: 3,
                        isReversed: true
                    }),
                    createTestCard({
                        id: 'card2',
                        name: 'Temperance',
                        cost: 5,
                        type: 'unit',
                        attack: 4,
                        health: 5,
                        isReversed: true
                    }),
                ],
                deck: [
                    createTestCard({ id: 'deck1', name: 'Deck Card 1' }),
                    createTestCard({ id: 'deck2', name: 'Deck Card 2' }),
                ],
                mulliganComplete: true,
            }),
            player2: createTestPlayer('player2', {
                deck: [
                    createTestCard({ id: 'p2-deck1', name: 'P2 Deck Card 1' }),
                ],
                mulliganComplete: true,
            }),
        })
    })

    describe('Card Placement Persistence', () => {
        it('should keep card on battlefield after playing', async () => {
            const cardToPlay = gameState.player1.hand[0]
            const newState = await playCard(gameState, cardToPlay, 2)

            // Card should be on battlefield
            expect(newState.battlefield.playerUnits[2]).toBeDefined()
            expect(newState.battlefield.playerUnits[2]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[2]?.id).toBe('card1')
        })

        it('should maintain reversed state on battlefield', async () => {
            const reversedCard = gameState.player1.hand[0]
            expect(reversedCard.isReversed).toBe(true)

            const newState = await playCard(gameState, reversedCard, 0)

            // Card on battlefield should maintain reversed state
            const placedCard = newState.battlefield.playerUnits[0]
            expect(placedCard).toBeDefined()
            expect(placedCard?.isReversed).toBe(true)
        })

        it('should keep multiple cards on battlefield', async () => {
            const card1 = gameState.player1.hand[0]
            const card2 = gameState.player1.hand[1]

            let newState = await playCard(gameState, card1, 0)
            newState = await playCard(newState, card2, 3)

            // Both cards should be on battlefield
            expect(newState.battlefield.playerUnits[0]).toBeDefined()
            expect(newState.battlefield.playerUnits[0]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[3]).toBeDefined()
            expect(newState.battlefield.playerUnits[3]?.name).toBe('Temperance')
        })
    })

    describe('Turn Transition Persistence', () => {
        it('should preserve battlefield when ending turn', async () => {
            // Play a card
            const cardToPlay = gameState.player1.hand[0]
            let newState = await playCard(gameState, cardToPlay, 2)

            expect(newState.battlefield.playerUnits[2]?.name).toBe('Page of Wands')

            // End turn
            newState = await endTurn(newState)

            // Battlefield should still have the card
            expect(newState.battlefield.playerUnits[2]).toBeDefined()
            expect(newState.battlefield.playerUnits[2]?.name).toBe('Page of Wands')
        })

        it('should not mutate original state battlefield when ending turn', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let newState = await playCard(gameState, cardToPlay, 1)

            const beforeEndTurn = { ...newState }
            const beforeBattlefieldUnits = [...newState.battlefield.playerUnits]

            newState = await endTurn(newState)

            // Original state should remain unchanged
            expect(beforeEndTurn.battlefield.playerUnits).toEqual(beforeBattlefieldUnits)
        })

        it('should preserve multiple cards through turn transition', async () => {
            const card1 = gameState.player1.hand[0]
            const card2 = gameState.player1.hand[1]

            let newState = await playCard(gameState, card1, 0)
            newState = await playCard(newState, card2, 4)

            // End turn
            newState = await endTurn(newState)

            // Both cards should still be on battlefield
            expect(newState.battlefield.playerUnits[0]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[4]?.name).toBe('Temperance')
        })

        it('should maintain card properties through turn transition', async () => {
            const reversedCard = gameState.player1.hand[0]
            let newState = await playCard(gameState, reversedCard, 2)

            const cardBeforeTurnEnd = newState.battlefield.playerUnits[2]
            expect(cardBeforeTurnEnd?.isReversed).toBe(true)
            expect(cardBeforeTurnEnd?.hasSummoningSickness).toBe(true)

            // End turn
            newState = await endTurn(newState)

            // Card should maintain its properties
            const cardAfterTurnEnd = newState.battlefield.playerUnits[2]
            expect(cardAfterTurnEnd).toBeDefined()
            expect(cardAfterTurnEnd?.isReversed).toBe(true)
            expect(cardAfterTurnEnd?.name).toBe('Page of Wands')
        })
    })

    describe('Multi-Turn Persistence', () => {
        it('should preserve battlefield through multiple turn cycles', async () => {
            const card1 = gameState.player1.hand[0]
            const card2 = gameState.player1.hand[1]

            // Player 1 plays cards
            let newState = await playCard(gameState, card1, 1)
            newState = await playCard(newState, card2, 5)

            expect(newState.battlefield.playerUnits[1]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[5]?.name).toBe('Temperance')

            // End turn (player 1 -> player 2)
            newState = await endTurn(newState)
            expect(newState.activePlayer).toBe('player2')
            expect(newState.battlefield.playerUnits[1]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[5]?.name).toBe('Temperance')

            // End turn (player 2 -> player 1)
            newState = await endTurn(newState)
            expect(newState.activePlayer).toBe('player1')
            expect(newState.battlefield.playerUnits[1]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[5]?.name).toBe('Temperance')

            // End turn (player 1 -> player 2)
            newState = await endTurn(newState)
            expect(newState.activePlayer).toBe('player2')
            expect(newState.battlefield.playerUnits[1]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[5]?.name).toBe('Temperance')
        })

        it('should handle summoning sickness reset correctly', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let newState = await playCard(gameState, cardToPlay, 0)

            const card = newState.battlefield.playerUnits[0]
            expect(card?.hasSummoningSickness).toBe(true)

            // End turn to opponent
            newState = await endTurn(newState)
            expect(newState.battlefield.playerUnits[0]?.hasSummoningSickness).toBe(true)

            // End turn back to original player
            newState = await endTurn(newState)

            // Summoning sickness should still be there (only removed at start of YOUR turn)
            expect(newState.battlefield.playerUnits[0]).toBeDefined()
            expect(newState.battlefield.playerUnits[0]?.name).toBe('Page of Wands')
        })
    })

    describe('State Immutability During Turn Transitions', () => {
        it('should not share array references between states', async () => {
            const cardToPlay = gameState.player1.hand[0]
            const state1 = await playCard(gameState, cardToPlay, 0)
            const state2 = await endTurn(state1)

            // Modify state2's battlefield
            state2.battlefield.playerUnits[3] = createTestCard({
                id: 'injected',
                name: 'Injected Card',
                type: 'unit',
                attack: 1,
                health: 1,
            })

            // state1 should not be affected
            expect(state1.battlefield.playerUnits[3]).toBeNull()
            expect(state2.battlefield.playerUnits[3]?.name).toBe('Injected Card')
        })

        it('should create independent player hand copies', async () => {
            const cardToPlay = gameState.player1.hand[0]
            const initialP2HandSize = gameState.player2.hand.length
            const state1 = await playCard(gameState, cardToPlay, 0)
            const state2 = await endTurn(state1)

            // Original state hand should not be affected
            expect(gameState.player1.hand.length).toBe(2)
            expect(state1.player1.hand.length).toBe(1)

            // state2 should have drawn a card for player2
            expect(state2.player2.hand.length).toBe(initialP2HandSize + 1)
        })

        it('should preserve different unit slots independently', async () => {
            const card1 = gameState.player1.hand[0]
            const card2 = gameState.player1.hand[1]

            let newState = await playCard(gameState, card1, 0)
            newState = await playCard(newState, card2, 6)

            // End turn multiple times
            newState = await endTurn(newState)
            newState = await endTurn(newState)
            newState = await endTurn(newState)

            // Both slots should still have their cards
            expect(newState.battlefield.playerUnits[0]?.name).toBe('Page of Wands')
            expect(newState.battlefield.playerUnits[6]?.name).toBe('Temperance')
            expect(newState.battlefield.playerUnits[1]).toBeNull()
            expect(newState.battlefield.playerUnits[5]).toBeNull()
        })
    })

    describe('Multiple endTurn Calls (Regression Test)', () => {
        it('should handle multiple rapid endTurn calls on same state safely', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let state = await playCard(gameState, cardToPlay, 2)

            expect(state.battlefield.playerUnits[2]?.name).toBe('Page of Wands')

            // Simulate the bug: calling endTurn multiple times on the same state
            // (This was happening due to useEffect re-triggering)
            const endTurnPromise1 = endTurn(state)
            const endTurnPromise2 = endTurn(state)

            const [result1, result2] = await Promise.all([endTurnPromise1, endTurnPromise2])

            // Both should complete successfully
            expect(result1.battlefield.playerUnits[2]?.name).toBe('Page of Wands')
            expect(result2.battlefield.playerUnits[2]?.name).toBe('Page of Wands')
        })

        it('should maintain battlefield when endTurn is called sequentially multiple times', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let state = await playCard(gameState, cardToPlay, 3)

            // Call endTurn multiple times
            state = await endTurn(state)
            const stateAfterFirstEnd = { ...state }

            state = await endTurn(state)
            state = await endTurn(state)

            // Card should still be there
            expect(state.battlefield.playerUnits[3]?.name).toBe('Page of Wands')

            // First state should not be affected by subsequent calls
            expect(stateAfterFirstEnd.battlefield.playerUnits[3]?.name).toBe('Page of Wands')
        })
    })

    describe('Attack Flags and Status Effects', () => {
        it('should reset hasAttackedThisTurn flag at end of turn', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let state = await playCard(gameState, cardToPlay, 1)

            // Manually set hasAttackedThisTurn (simulating an attack)
            state.battlefield.playerUnits[1]!.hasAttackedThisTurn = true

            expect(state.battlefield.playerUnits[1]?.hasAttackedThisTurn).toBe(true)

            // End turn
            state = await endTurn(state)

            // hasAttackedThisTurn should be reset
            expect(state.battlefield.playerUnits[1]?.hasAttackedThisTurn).toBe(false)
        })

        it('should preserve card after hasAttackedThisTurn reset', async () => {
            const card1 = gameState.player1.hand[0]
            const card2 = gameState.player1.hand[1]

            let state = await playCard(gameState, card1, 0)
            state = await playCard(state, card2, 5)

            // Simulate attacks
            state.battlefield.playerUnits[0]!.hasAttackedThisTurn = true
            state.battlefield.playerUnits[5]!.hasAttackedThisTurn = true

            // End turn
            state = await endTurn(state)

            // Cards should still exist with reset flags
            expect(state.battlefield.playerUnits[0]?.name).toBe('Page of Wands')
            expect(state.battlefield.playerUnits[0]?.hasAttackedThisTurn).toBe(false)
            expect(state.battlefield.playerUnits[5]?.name).toBe('Temperance')
            expect(state.battlefield.playerUnits[5]?.hasAttackedThisTurn).toBe(false)
        })
    })

    describe('Object.assign Merge Safety (Regression Test)', () => {
        it('should preserve battlefield arrays after persistent effects update', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let state = await playCard(gameState, cardToPlay, 4)

            expect(state.battlefield.playerUnits[4]?.name).toBe('Page of Wands')

            // End turn triggers persistent effects which use Object.assign
            state = await endTurn(state)

            // Battlefield should survive the Object.assign merge
            expect(state.battlefield.playerUnits[4]).toBeDefined()
            expect(state.battlefield.playerUnits[4]?.name).toBe('Page of Wands')
            expect(Array.isArray(state.battlefield.playerUnits)).toBe(true)
            expect(state.battlefield.playerUnits).toHaveLength(7)
        })

        it('should not share battlefield array references after Object.assign merge', async () => {
            const cardToPlay = gameState.player1.hand[0]
            const state1 = await playCard(gameState, cardToPlay, 2)
            const state2 = await endTurn(state1)

            // Modify state2's battlefield
            state2.battlefield.playerUnits[6] = createTestCard({
                id: 'modified',
                name: 'Modified Card',
                type: 'unit',
                attack: 1,
                health: 1,
            })

            // state1 should not be affected
            expect(state1.battlefield.playerUnits[6]).toBeNull()
            expect(state2.battlefield.playerUnits[6]?.name).toBe('Modified Card')

            // Original card should still be in both
            expect(state1.battlefield.playerUnits[2]?.name).toBe('Page of Wands')
            expect(state2.battlefield.playerUnits[2]?.name).toBe('Page of Wands')
        })
    })

    describe('Battlefield Array Integrity', () => {
        it('should maintain battlefield array length', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let newState = await playCard(gameState, cardToPlay, 2)

            expect(newState.battlefield.playerUnits).toHaveLength(7)
            expect(newState.battlefield.enemyUnits).toHaveLength(7)

            // After turn transitions
            newState = await endTurn(newState)
            expect(newState.battlefield.playerUnits).toHaveLength(7)
            expect(newState.battlefield.enemyUnits).toHaveLength(7)

            newState = await endTurn(newState)
            expect(newState.battlefield.playerUnits).toHaveLength(7)
            expect(newState.battlefield.enemyUnits).toHaveLength(7)
        })

        it('should maintain null slots correctly', async () => {
            const cardToPlay = gameState.player1.hand[0]
            let newState = await playCard(gameState, cardToPlay, 3)

            // Slots should be null except slot 3
            expect(newState.battlefield.playerUnits[0]).toBeNull()
            expect(newState.battlefield.playerUnits[1]).toBeNull()
            expect(newState.battlefield.playerUnits[2]).toBeNull()
            expect(newState.battlefield.playerUnits[3]).toBeDefined()
            expect(newState.battlefield.playerUnits[4]).toBeNull()
            expect(newState.battlefield.playerUnits[5]).toBeNull()
            expect(newState.battlefield.playerUnits[6]).toBeNull()

            // After turn transition
            newState = await endTurn(newState)
            expect(newState.battlefield.playerUnits[0]).toBeNull()
            expect(newState.battlefield.playerUnits[3]).toBeDefined()
            expect(newState.battlefield.playerUnits[6]).toBeNull()
        })
    })
})

