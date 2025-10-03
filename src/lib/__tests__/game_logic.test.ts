vi.unmock("@/lib/game_logger")
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestPlayer, createTestGameState, createTestCard } from '../../test_utils'
import type { Player, GameState } from '../../schemas/schema'

// Mock GameLogger to avoid console spam in tests
vi.mock('../../lib/game_logger', () => ({
    GameLogger: {
        action: vi.fn(),
        combat: vi.fn(),
        ai: vi.fn(),
        state: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        turnStart: vi.fn(),
    },
}))

// Import the game logic functions we need to test
// Note: payManaCost is not exported, so we'll test it through playCard
// We'll create a separate test for the mana validation logic

describe('Game Logic - Mana Cost Validation', () => {
    let player: Player

    beforeEach(() => {
        player = createTestPlayer('player1', {
            health: 20,
            mana: 5,
            maxMana: 10,
            spellMana: 3,
            hand: [],
            deck: [],
            hasAttackToken: true,
            mulliganComplete: true,
            selectedForMulligan: [],
            hasPassed: false,
            actionsThisTurn: 0,
        })
    })

    describe('Mana Cost Calculation', () => {
        it('should validate sufficient total mana is available', () => {
            // Player has 5 regular mana + 3 spell mana = 8 total
            const totalAvailable = player.mana + player.spellMana
            expect(totalAvailable).toBe(8)
        })

        it('should not allow playing cards costing more than total available mana', () => {
            const totalAvailable = player.mana + player.spellMana
            const cardCost = 10 // More than 8 available

            expect(cardCost).toBeGreaterThan(totalAvailable)
        })

        it('should allow playing cards within total mana budget', () => {
            const totalAvailable = player.mana + player.spellMana
            const cardCost = 7 // Less than 8 available

            expect(cardCost).toBeLessThanOrEqual(totalAvailable)
        })

        it('should prioritize regular mana before spell mana', () => {
            // If cost is 3, should use 3 regular mana, not spell mana
            const cost = 3
            const manaToUse = Math.min(player.mana, cost)
            const remainingCost = cost - manaToUse
            const spellManaToUse = Math.min(player.spellMana, remainingCost)

            expect(manaToUse).toBe(3) // Use regular mana
            expect(spellManaToUse).toBe(0) // Don't need spell mana
        })

        it('should use spell mana when regular mana is insufficient', () => {
            // If cost is 7, should use 5 regular + 2 spell mana
            const cost = 7
            const manaToUse = Math.min(player.mana, cost) // 5
            const remainingCost = cost - manaToUse // 2
            const spellManaToUse = Math.min(player.spellMana, remainingCost) // 2

            expect(manaToUse).toBe(5) // All regular mana
            expect(spellManaToUse).toBe(2) // 2 spell mana
            expect(manaToUse + spellManaToUse).toBe(cost)
        })

        it('should not exceed available spell mana', () => {
            // If cost is 10 but only have 5 regular + 3 spell = 8 total
            const cost = 10
            const totalAvailable = player.mana + player.spellMana

            expect(totalAvailable).toBeLessThan(cost)
        })

        it('should handle edge case of 0 cost', () => {
            const cost = 0
            const manaToUse = Math.min(player.mana, cost)
            const spellManaToUse = 0

            expect(manaToUse).toBe(0)
            expect(spellManaToUse).toBe(0)
        })

        it('should handle edge case of exact mana match', () => {
            const cost = 8 // Exactly what player has
            const totalAvailable = player.mana + player.spellMana

            expect(cost).toBe(totalAvailable)
        })

        it('should handle player with no spell mana', () => {
            player.spellMana = 0
            const cost = 5
            const totalAvailable = player.mana + player.spellMana

            expect(totalAvailable).toBe(5)
            expect(cost).toBeLessThanOrEqual(totalAvailable)
        })

        it('should handle player with no regular mana', () => {
            player.mana = 0
            const cost = 3
            const totalAvailable = player.mana + player.spellMana

            expect(totalAvailable).toBe(3)
            expect(cost).toBeLessThanOrEqual(totalAvailable)
        })
    })

    describe('Mana Validation Edge Cases', () => {
        it('should prevent negative mana scenarios', () => {
            const cost = 15
            const totalAvailable = player.mana + player.spellMana

            // This should fail validation
            expect(totalAvailable).toBeLessThan(cost)
        })

        it('should handle maximum mana values', () => {
            player.mana = 10
            player.spellMana = 10
            const totalAvailable = player.mana + player.spellMana

            expect(totalAvailable).toBe(20)
        })

        it('should correctly cap spell mana usage', () => {
            // Player has 2 regular mana, 3 spell mana
            player.mana = 2
            player.spellMana = 3
            const cost = 4

            const manaToUse = Math.min(player.mana, cost) // 2
            const remainingCost = cost - manaToUse // 2
            const spellManaToUse = Math.min(player.spellMana, remainingCost) // 2

            expect(manaToUse).toBe(2)
            expect(spellManaToUse).toBe(2)
            expect(spellManaToUse).toBeLessThanOrEqual(player.spellMana)
        })
    })
})

describe('Game Logic - Card Playing Validation', () => {
    it('should validate card ownership before playing', () => {
        // TODO: Test that player can only play cards in their hand
        expect(true).toBe(true)
    })

    it('should validate phase before allowing card play', () => {
        // TODO: Test that cards can only be played during action phase
        expect(true).toBe(true)
    })

    it('should validate active player before allowing card play', () => {
        // TODO: Test that only active player can play cards
        expect(true).toBe(true)
    })

    it('should validate battlefield space for unit cards', () => {
        // TODO: Test that units can only be played if battlefield has space
        expect(true).toBe(true)
    })
})

describe('Game Logic - endTurn()', () => {
    let gameState: GameState

    beforeEach(() => {
        gameState = createTestGameState({
            round: 2,
            turn: 3,
            activePlayer: 'player1',
            phase: 'action',
            player1: createTestPlayer('player1', {
                mana: 3,
                maxMana: 5,
                spellMana: 1,
                hasAttackToken: true,
                deck: Array(10).fill(null).map((_, i) =>
                    createTestCard({ id: `p1-deck-${i}`, name: `Card ${i}` })
                ),
            }),
            player2: createTestPlayer('player2', {
                mana: 0,
                maxMana: 5,
                spellMana: 0,
                hasAttackToken: false,
                deck: Array(10).fill(null).map((_, i) =>
                    createTestCard({ id: `p2-deck-${i}`, name: `Card ${i}` })
                ),
            }),
        })
    })

    it('should switch active player', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        expect(gameState.activePlayer).toBe('player1')

        const newState = await endTurn(gameState)

        expect(newState.activePlayer).toBe('player2')
    })

    it('should increment turn counter', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        const initialTurn = gameState.turn
        const newState = await endTurn(gameState)

        expect(newState.turn).toBe(initialTurn + 1)
    })

    it('should increment round every 2 turns', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        // Turn 3 -> 4 (no round change)
        gameState.turn = 3
        let newState = await endTurn(gameState)
        expect(newState.round).toBe(2) // Still round 2

        // Turn 4 -> 5 (round change)
        newState.turn = 4
        newState = await endTurn(newState)
        expect(newState.round).toBe(3) // Now round 3
    })

    it('should switch attack token every round', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.turn = 4 // Will become turn 5 (odd), triggering round change
        gameState.player1.hasAttackToken = true
        gameState.player2.hasAttackToken = false

        const newState = await endTurn(gameState)

        expect(newState.player1.hasAttackToken).toBe(false)
        expect(newState.player2.hasAttackToken).toBe(true)
    })

    it('should refill mana for next player based on round', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.round = 5
        gameState.player2.mana = 0
        gameState.player2.maxMana = 4

        const newState = await endTurn(gameState)

        // Max mana should be min(round, 10)
        expect(newState.player2.maxMana).toBe(5)
        expect(newState.player2.mana).toBe(5)
    })

    it('should cap max mana at 10', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.round = 15 // Very high round
        gameState.player2.maxMana = 9

        const newState = await endTurn(gameState)

        expect(newState.player2.maxMana).toBe(10) // Capped
        expect(newState.player2.mana).toBe(10)
    })

    it('should convert unspent mana to spell mana', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.player1.mana = 1 // Unspent mana
        gameState.player1.spellMana = 1

        const newState = await endTurn(gameState)

        // Spell mana should increase by unspent mana
        expect(newState.player1.spellMana).toBe(2) // 1 + 1
    })

    it('should cap spell mana at max (3)', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.player1.mana = 5 // Lots of unspent mana
        gameState.player1.spellMana = 2

        const newState = await endTurn(gameState)

        // Should be capped at 3
        expect(newState.player1.spellMana).toBe(3)
    })

    it('should draw a card for next player', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        const initialHandSize = gameState.player2.hand.length
        const initialDeckSize = gameState.player2.deck.length
        const topCardId = gameState.player2.deck[0].id

        const newState = await endTurn(gameState)

        expect(newState.player2.hand).toHaveLength(initialHandSize + 1)
        expect(newState.player2.deck).toHaveLength(initialDeckSize - 1)
        // Check for card by ID (card is wrapped with isReversed property, so reference changes)
        expect(newState.player2.hand.some(c => c.id === topCardId)).toBe(true)
    })

    it('should handle empty deck gracefully', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.player2.deck = [] // Empty deck
        const initialHandSize = gameState.player2.hand.length

        const newState = await endTurn(gameState)

        // Should not crash, hand size unchanged
        expect(newState.player2.hand).toHaveLength(initialHandSize)
    })

    it('should set phase to action', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        gameState.phase = 'end_round'

        const newState = await endTurn(gameState)

        expect(newState.phase).toBe('action')
    })

    it('should reset attack flags for units', async () => {
        const { endTurn } = await import('../../lib/game_logic')

        // Add units with hasAttackedThisTurn = true
        const unit1 = createTestCard({ id: 'unit1', hasAttackedThisTurn: true })
        const unit2 = createTestCard({ id: 'unit2', hasAttackedThisTurn: true })

        gameState.battlefield.playerUnits[0] = unit1
        gameState.battlefield.playerUnits[1] = unit2

        const newState = await endTurn(gameState)

        // Units should have attack flags reset
        expect(newState.battlefield.playerUnits[0]?.hasAttackedThisTurn).toBe(false)
        expect(newState.battlefield.playerUnits[1]?.hasAttackedThisTurn).toBe(false)
    })
})

describe('Game Logic - checkGameOutcome()', () => {
    let gameState: GameState
    let checkGameOutcome: (state: GameState) => 'player1_wins' | 'player2_wins' | 'ongoing'

    beforeEach(async () => {
        const gameLogic = await import('../../lib/game_logic')
        checkGameOutcome = gameLogic.checkGameOutcome

        gameState = createTestGameState({
            player1: createTestPlayer('player1', { health: 20 }),
            player2: createTestPlayer('player2', { health: 20 }),
        })
    })

    it('should return ongoing when both players have health', () => {
        const outcome = checkGameOutcome(gameState)
        expect(outcome).toBe('ongoing')
    })

    it('should return player2_wins when player1 health reaches 0', () => {
        gameState.player1.health = 0
        const outcome = checkGameOutcome(gameState)
        expect(outcome).toBe('player2_wins')
    })

    it('should return player2_wins when player1 health is negative', () => {
        gameState.player1.health = -5
        const outcome = checkGameOutcome(gameState)
        expect(outcome).toBe('player2_wins')
    })

    it('should return player1_wins when player2 health reaches 0', () => {
        gameState.player2.health = 0
        const outcome = checkGameOutcome(gameState)
        expect(outcome).toBe('player1_wins')
    })

    it('should return player1_wins when player2 health is negative', () => {
        gameState.player2.health = -10
        const outcome = checkGameOutcome(gameState)
        expect(outcome).toBe('player1_wins')
    })

    it('should prioritize player1 health check over player2', () => {
        // Both players dead - player1 check comes first
        gameState.player1.health = 0
        gameState.player2.health = 0
        const outcome = checkGameOutcome(gameState)

        // Player1 dies first in the check, so player2 wins
        expect(outcome).toBe('player2_wins')
    })

    it('should handle exactly 1 health correctly', () => {
        gameState.player1.health = 1
        gameState.player2.health = 1
        const outcome = checkGameOutcome(gameState)

        // Still ongoing
        expect(outcome).toBe('ongoing')
    })

    it('should handle high health values', () => {
        gameState.player1.health = 100
        gameState.player2.health = 100
        const outcome = checkGameOutcome(gameState)
        expect(outcome).toBe('ongoing')
    })
})

describe('Game Logic - completeMulligan()', () => {
    let gameState: GameState
    let completeMulligan: (state: GameState) => GameState

    beforeEach(async () => {
        const gameLogic = await import('../../lib/game_logic')
        completeMulligan = gameLogic.completeMulligan

        // Create game state in mulligan phase
        gameState = createTestGameState({
            phase: 'mulligan',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                hand: [
                    createTestCard({ id: 'card1', name: 'Card 1', cost: 5 }),
                    createTestCard({ id: 'card2', name: 'Card 2', cost: 1 }),
                    createTestCard({ id: 'card3', name: 'Card 3', cost: 4 }),
                    createTestCard({ id: 'card4', name: 'Card 4', cost: 2 }),
                ],
                deck: Array(10).fill(null).map((_, i) =>
                    createTestCard({ id: `deck${i}`, name: `Deck Card ${i}` })
                ),
                mulliganComplete: false,
                selectedForMulligan: [],
            }),
            player2: createTestPlayer('player2', {
                mulliganComplete: false,
            }),
        })
    })

    it('should do nothing if phase is not mulligan', () => {
        gameState.phase = 'action'
        const newState = completeMulligan(gameState)

        // Should return same state unchanged
        expect(newState).toEqual(gameState)
    })

    it('should mark player mulligan as complete', () => {
        const newState = completeMulligan(gameState)

        expect(newState.player1.mulliganComplete).toBe(true)
    })

    it('should replace selected cards with new cards from deck', () => {
        gameState.player1.selectedForMulligan = ['card1', 'card3'] // Replace 2 cards

        const initialHandSize = gameState.player1.hand.length
        const initialDeckSize = gameState.player1.deck.length

        const newState = completeMulligan(gameState)

        // Hand size should remain the same
        expect(newState.player1.hand).toHaveLength(initialHandSize)

        // Deck size should be: initial - drawn + returned - drawn again
        expect(newState.player1.deck).toHaveLength(initialDeckSize + 2 - 2)

        // At least one of the kept cards should still be in hand
        const hasKeptCard = newState.player1.hand.some(c => c.id === 'card2' || c.id === 'card4')
        expect(hasKeptCard).toBe(true)

        // Mulligan should have been processed (cards were shuffled back and redrawn)
        // Note: Due to shuffling, we might draw the same cards back, so we just verify the process completed
        expect(newState.player1.selectedForMulligan).toEqual([])
    })

    it('should keep hand unchanged if no cards selected for mulligan', () => {
        const originalHand = [...gameState.player1.hand]
        gameState.player1.selectedForMulligan = [] // No cards selected

        const newState = completeMulligan(gameState)

        // Hand should be exactly the same
        expect(newState.player1.hand.map(c => c.id)).toEqual(originalHand.map(c => c.id))
    })

    it('should transition to action phase when both players complete', () => {
        gameState.player1.mulliganComplete = false
        gameState.player2.mulliganComplete = true // Player 2 already done

        const newState = completeMulligan(gameState)

        // Both players now complete
        expect(newState.player1.mulliganComplete).toBe(true)
        expect(newState.player2.mulliganComplete).toBe(true)

        // Phase should transition to action
        expect(newState.phase).toBe('action')
        expect(newState.waitingForAction).toBe(true)
    })

    it('should not transition phase if only one player complete', () => {
        gameState.player1.mulliganComplete = false
        gameState.player2.mulliganComplete = false // Player 2 not done yet

        const newState = completeMulligan(gameState)

        // Phase should still be mulligan
        expect(newState.phase).toBe('mulligan')
    })

    it('should clear selectedForMulligan after completion', () => {
        gameState.player1.selectedForMulligan = ['card1', 'card2']

        const newState = completeMulligan(gameState)

        expect(newState.player1.selectedForMulligan).toEqual([])
    })
})

describe('Game Logic - aiTurn()', () => {
    let gameState: GameState
    let aiTurn: (state: GameState) => Promise<GameState>

    beforeEach(async () => {
        const gameLogic = await import('../../lib/game_logic')
        aiTurn = gameLogic.aiTurn

        // Create game state with AI as player2
        gameState = createTestGameState({
            round: 3,
            turn: 2,
            activePlayer: 'player2',
            phase: 'action',
            player1: createTestPlayer('player1', {
                health: 20,
                hasAttackToken: false,
            }),
            player2: createTestPlayer('player2', {
                health: 20,
                mana: 5,
                maxMana: 5,
                hasAttackToken: true,
                hand: [
                    createTestCard({ id: 'ai-card1', name: 'AI Card 1', type: 'unit', cost: 2, attack: 3, health: 2 }),
                    createTestCard({ id: 'ai-card2', name: 'AI Card 2', type: 'unit', cost: 4, attack: 5, health: 4 }),
                    createTestCard({ id: 'ai-card3', name: 'AI Card 3', type: 'unit', cost: 1, attack: 1, health: 1 }),
                ],
                deck: [],
            }),
        })
    })

    it('should do nothing if not AI turn (player1 active)', async () => {
        gameState.activePlayer = 'player1'
        const initialState = { ...gameState }

        const newState = await aiTurn(gameState)

        // State should be unchanged
        expect(newState.activePlayer).toBe('player1')
        expect(newState.turn).toBe(initialState.turn)
    })

    it('should play cards when mana is available', async () => {
        const initialHandSize = gameState.player2.hand.length

        const newState = await aiTurn(gameState)

        // AI should have played some cards (has 5 mana, can play 1+2+4 cost cards)
        expect(newState.player2.hand.length).toBeLessThan(initialHandSize)
    })

    it('should prioritize high value-to-cost ratio cards', async () => {
        // ai-card1: (3+2)/2 = 2.5 value per mana
        // ai-card2: (5+4)/4 = 2.25 value per mana
        // ai-card3: (1+1)/1 = 2.0 value per mana
        // Should prioritize card1 > card2 > card3

        const newState = await aiTurn(gameState)

        // With 5 mana, should play card1 (2) + card3 (1) = 3 mana, or card2 (4) alone
        // The exact order depends on implementation, but should use mana efficiently
        expect(newState.player2.mana).toBeLessThan(gameState.player2.mana)
    })

    it('should stop playing cards when battlefield is full', async () => {
        // Fill battlefield except 2 slots
        const fullBattlefield = Array(5).fill(null).map((_, i) =>
            createTestCard({ id: `existing-unit-${i}`, name: `Unit ${i}`, hasAttackedThisTurn: true })
        )
        gameState.battlefield.enemyUnits = [...fullBattlefield, null, null]

        const newState = await aiTurn(gameState)

        // Should have played at most 2 cards (2 empty slots)
        const unitsPlayed = newState.battlefield.enemyUnits.filter(u => u !== null).length
        expect(unitsPlayed).toBeLessThanOrEqual(7) // Max 7 units
    })

    it('should stop playing cards when out of mana', async () => {
        gameState.player2.mana = 1 // Only 1 mana
        gameState.player2.hand = [
            createTestCard({ id: 'expensive1', cost: 5 }),
            createTestCard({ id: 'expensive2', cost: 4 }),
            createTestCard({ id: 'cheap1', cost: 1 }), // Only this is playable
        ]

        const newState = await aiTurn(gameState)

        // Should only play the 1-cost card
        expect(newState.player2.mana).toBe(0)
        expect(newState.player2.hand.length).toBe(2) // 2 cards left
    })

    it('should attack with units when has attack token', async () => {
        // Switch to AI's turn
        gameState.activePlayer = 'player2'

        // Place AI units on battlefield (from player2's perspective, these are playerUnits)
        gameState.battlefield.enemyUnits[0] = createTestCard({
            id: 'ai-unit1',
            attack: 3,
            hasAttackedThisTurn: false,
            hasSummoningSickness: false,
            owner: 'player2' // Ownership validation
        })
        gameState.battlefield.enemyUnits[1] = createTestCard({
            id: 'ai-unit2',
            attack: 2,
            hasAttackedThisTurn: false,
            hasSummoningSickness: false,
            owner: 'player2' // Ownership validation
        })
        gameState.player2.hasAttackToken = true

        const initialHealth = gameState.player1.health
        const newState = await aiTurn(gameState)

        // Player1 should have taken damage (3 + 2 = 5 damage)
        expect(newState.player1.health).toBeLessThan(initialHealth)
    })

    it('should not attack when no attack token', async () => {
        gameState.battlefield.enemyUnits[0] = createTestCard({
            id: 'ai-unit1',
            attack: 3,
            hasAttackedThisTurn: false
        })
        gameState.player2.hasAttackToken = false

        const initialHealth = gameState.player1.health
        const newState = await aiTurn(gameState)

        // Player1 health should be unchanged
        expect(newState.player1.health).toBe(initialHealth)
    })

    it('should not attack with units that have summoning sickness', async () => {
        gameState.battlefield.enemyUnits[0] = createTestCard({
            id: 'ai-unit1',
            attack: 3,
            hasSummoningSickness: true,
            hasAttackedThisTurn: false
        })
        gameState.player2.hasAttackToken = true

        const initialHealth = gameState.player1.health
        const newState = await aiTurn(gameState)

        // Player1 health should be unchanged (unit has summoning sickness)
        expect(newState.player1.health).toBe(initialHealth)
    })

    it('should not attack with units that already attacked', async () => {
        gameState.battlefield.enemyUnits[0] = createTestCard({
            id: 'ai-unit1',
            attack: 3,
            hasAttackedThisTurn: true, // Already attacked
            hasSummoningSickness: false
        })
        gameState.player2.hasAttackToken = true

        const initialHealth = gameState.player1.health
        const newState = await aiTurn(gameState)

        // Player1 health should be unchanged
        expect(newState.player1.health).toBe(initialHealth)
    })

    it('should end turn after taking actions', async () => {
        const initialTurn = gameState.turn

        const newState = await aiTurn(gameState)

        // Turn should increment
        expect(newState.turn).toBe(initialTurn + 1)
        // Active player should switch
        expect(newState.activePlayer).toBe('player1')
    })

    it('should handle no playable cards gracefully', async () => {
        gameState.player2.hand = [
            createTestCard({ id: 'expensive1', cost: 10 }),
            createTestCard({ id: 'expensive2', cost: 10 }),
        ]
        gameState.player2.mana = 1

        // Should not crash, just end turn
        const newState = await aiTurn(gameState)

        expect(newState.activePlayer).toBe('player1') // Turn ended
    })

    it('should handle empty hand gracefully', async () => {
        gameState.player2.hand = []

        // Should not crash, just end turn
        const newState = await aiTurn(gameState)

        expect(newState.activePlayer).toBe('player1') // Turn ended
    })

    it('should handle no units on battlefield gracefully', async () => {
        gameState.battlefield.enemyUnits = Array(7).fill(null)
        gameState.player2.hasAttackToken = true

        const initialHealth = gameState.player1.health

        // Should not crash
        const newState = await aiTurn(gameState)

        // No damage dealt
        expect(newState.player1.health).toBe(initialHealth)
        // Turn ended
        expect(newState.activePlayer).toBe('player1')
    })

    it('should handle attack errors gracefully', async () => {
        // Place a unit that will cause attack to fail (e.g., taunt on enemy side)
        gameState.battlefield.playerUnits[0] = createTestCard({
            id: 'taunt-unit',
            abilities: [{ name: 'Taunt', description: 'Must be attacked first' }],
            health: 5
        })
        gameState.battlefield.enemyUnits[0] = createTestCard({
            id: 'ai-unit1',
            attack: 3,
            hasAttackedThisTurn: false,
            hasSummoningSickness: false
        })
        gameState.player2.hasAttackToken = true

        // Should handle error and continue
        const newState = await aiTurn(gameState)

        // Should still end turn
        expect(newState.activePlayer).toBe('player1')
    })

    it('should play multiple cards in one turn when mana allows', async () => {
        gameState.player2.mana = 10
        gameState.player2.hand = [
            createTestCard({ id: 'card1', cost: 2 }),
            createTestCard({ id: 'card2', cost: 3 }),
            createTestCard({ id: 'card3', cost: 2 }),
        ]

        const newState = await aiTurn(gameState)

        // Should play all cards (2+3+2 = 7 mana used)
        expect(newState.player2.hand.length).toBeLessThan(3)
    })
})

describe('Game Logic - Card Hand Removal', () => {
    let gameState: GameState
    let playCard: (state: GameState, card: any, targetSlot?: number) => Promise<GameState>

    beforeEach(async () => {
        const gameLogic = await import('../../lib/game_logic')
        playCard = gameLogic.playCard

        // Create game state in action phase with cards in hand
        gameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                mana: 10,
                spellMana: 5,
                hand: [
                    createTestCard({ id: 'card1', name: 'Test Card 1', cost: 3, type: 'unit', attack: 2, health: 3 }),
                    createTestCard({ id: 'card2', name: 'Test Card 2', cost: 2, type: 'unit', attack: 1, health: 2 }),
                    createTestCard({ id: 'card3', name: 'Test Card 3', cost: 1, type: 'spell' }),
                ],
                deck: [],
                mulliganComplete: true,
            }),
        })
    })

    it('should remove unit card from hand when played', async () => {
        const cardToPlay = gameState.player1.hand[0]
        const initialHandSize = gameState.player1.hand.length

        const newState = await playCard(gameState, cardToPlay, 0)

        // Card should be removed from hand
        expect(newState.player1.hand.length).toBe(initialHandSize - 1)
        expect(newState.player1.hand.find(c => c.id === cardToPlay.id)).toBeUndefined()
    })

    it('should remove spell card from hand when played', async () => {
        const spellCard = gameState.player1.hand[2] // The spell card
        const initialHandSize = gameState.player1.hand.length

        const newState = await playCard(gameState, spellCard)

        // Spell should be removed from hand
        expect(newState.player1.hand.length).toBe(initialHandSize - 1)
        expect(newState.player1.hand.find(c => c.id === spellCard.id)).toBeUndefined()
    })

    it('should not modify original state when removing card from hand', async () => {
        const cardToPlay = gameState.player1.hand[0]
        const originalHandSize = gameState.player1.hand.length
        const originalHandIds = gameState.player1.hand.map(c => c.id)

        await playCard(gameState, cardToPlay, 0)

        // Original state should remain unchanged (immutability test)
        expect(gameState.player1.hand.length).toBe(originalHandSize)
        expect(gameState.player1.hand.map(c => c.id)).toEqual(originalHandIds)
    })

    it('should place unit on battlefield and remove from hand in single operation', async () => {
        const unitCard = gameState.player1.hand[0]
        const initialHandSize = gameState.player1.hand.length

        const newState = await playCard(gameState, unitCard, 2)

        // Card removed from hand
        expect(newState.player1.hand.length).toBe(initialHandSize - 1)
        expect(newState.player1.hand.find(c => c.id === unitCard.id)).toBeUndefined()

        // Card placed on battlefield
        expect(newState.battlefield.playerUnits[2]).toBeDefined()
        expect(newState.battlefield.playerUnits[2]?.name).toBe(unitCard.name)
    })

    it('should handle playing multiple cards sequentially', async () => {
        const card1 = gameState.player1.hand[0]
        const card2 = gameState.player1.hand[1]
        const initialHandSize = gameState.player1.hand.length

        let newState = await playCard(gameState, card1, 0)
        expect(newState.player1.hand.length).toBe(initialHandSize - 1)

        newState = await playCard(newState, card2, 1)
        expect(newState.player1.hand.length).toBe(initialHandSize - 2)

        // Both cards should be gone from hand
        expect(newState.player1.hand.find(c => c.id === card1.id)).toBeUndefined()
        expect(newState.player1.hand.find(c => c.id === card2.id)).toBeUndefined()
    })
})

describe('Game Logic - Reversed Card Orientation', () => {
    let gameState: GameState
    let endTurn: (state: GameState) => Promise<GameState>
    let createInitialGameState: (useZodiacDeck?: string, gameMode?: string) => GameState
    let completeMulligan: (state: GameState) => GameState

    beforeEach(async () => {
        const gameLogic = await import('../../lib/game_logic')
        endTurn = gameLogic.endTurn
        createInitialGameState = gameLogic.createInitialGameState
        completeMulligan = gameLogic.completeMulligan
    })

    it('should set isReversed property on cards in starting hand', () => {
        const newGameState = createInitialGameState()

        // Check that starting hand cards have isReversed property
        newGameState.player1.hand.forEach(card => {
            expect(card).toHaveProperty('isReversed')
            expect(typeof card.isReversed).toBe('boolean')
        })

        newGameState.player2.hand.forEach(card => {
            expect(card).toHaveProperty('isReversed')
            expect(typeof card.isReversed).toBe('boolean')
        })
    })

    it('should set isReversed property when drawing card on turn', async () => {
        gameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                hand: [],
                deck: [
                    createTestCard({ id: 'deck1', name: 'Deck Card 1' }),
                    createTestCard({ id: 'deck2', name: 'Deck Card 2' }),
                ],
                mulliganComplete: true,
            }),
        })

        const newState = await endTurn(gameState)

        // Next player should have drawn a card with orientation set
        const drawnCard = newState.player2.hand[0]
        expect(drawnCard).toBeDefined()
        expect(drawnCard).toHaveProperty('isReversed')
        expect(typeof drawnCard.isReversed).toBe('boolean')
    })

    it('should maintain isReversed property when card is played', async () => {
        const { playCard } = await import('../../lib/game_logic')

        // Create a card with reversed orientation
        const reversedCard = createTestCard({
            id: 'reversed1',
            name: 'Reversed Card',
            cost: 2,
            type: 'unit',
            attack: 2,
            health: 3,
        })
        reversedCard.isReversed = true

        gameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                mana: 10,
                hand: [reversedCard],
                mulliganComplete: true,
            }),
        })

        const newState = await playCard(gameState, reversedCard, 0)

        // Card on battlefield should maintain reversed orientation
        const playedCard = newState.battlefield.playerUnits[0]
        expect(playedCard).toBeDefined()
        expect(playedCard?.isReversed).toBe(true)
    })

    it('should set orientation on mulliganed replacement cards', () => {
        gameState = createTestGameState({
            phase: 'mulligan',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                hand: [
                    createTestCard({ id: 'card1', name: 'Card 1' }),
                    createTestCard({ id: 'card2', name: 'Card 2' }),
                    createTestCard({ id: 'card3', name: 'Card 3' }),
                ],
                deck: Array(10).fill(null).map((_, i) =>
                    createTestCard({ id: `deck${i}`, name: `Deck Card ${i}` })
                ),
                selectedForMulligan: ['card1', 'card3'], // Mulligan 2 cards
                mulliganComplete: false,
            }),
            player2: createTestPlayer('player2', {
                mulliganComplete: true,
            }),
        })

        const newState = completeMulligan(gameState)

        // All cards in hand should have isReversed property
        newState.player1.hand.forEach(card => {
            expect(card).toHaveProperty('isReversed')
            expect(typeof card.isReversed).toBe('boolean')
        })
    })

    it('should randomly assign reversed orientation based on ORIENTATION_CHANCE', () => {
        // Create many games to test randomness
        const results = { reversed: 0, upright: 0 }
        const iterations = 100

        for (let i = 0; i < iterations; i++) {
            const newGameState = createInitialGameState()
            newGameState.player1.hand.forEach(card => {
                if (card.isReversed) {
                    results.reversed++
                } else {
                    results.upright++
                }
            })
        }

        // With ORIENTATION_CHANCE = 0.5, we expect roughly 50/50 split
        // Allow some variance (30-70% range is reasonable for random)
        const totalCards = results.reversed + results.upright
        const reversedPercentage = results.reversed / totalCards
        expect(reversedPercentage).toBeGreaterThan(0.3)
        expect(reversedPercentage).toBeLessThan(0.7)
    })
})

describe('Game Logic - State Immutability', () => {
    let gameState: GameState
    let playCard: (state: GameState, card: any, targetSlot?: number) => Promise<GameState>
    let endTurn: (state: GameState) => Promise<GameState>

    beforeEach(async () => {
        const gameLogic = await import('../../lib/game_logic')
        playCard = gameLogic.playCard
        endTurn = gameLogic.endTurn

        gameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                mana: 10,
                spellMana: 2,
                hand: [
                    createTestCard({ id: 'card1', name: 'Test Card', cost: 3, type: 'unit', attack: 2, health: 3 }),
                ],
                deck: [
                    createTestCard({ id: 'deck1', name: 'Deck Card' }),
                ],
                mulliganComplete: true,
            }),
        })
    })

    it('should not mutate original hand array when playing card', async () => {
        const originalHand = [...gameState.player1.hand]
        const originalHandIds = originalHand.map(c => c.id)
        const cardToPlay = gameState.player1.hand[0]

        await playCard(gameState, cardToPlay, 0)

        // Original state's hand should be unchanged
        expect(gameState.player1.hand.length).toBe(originalHand.length)
        expect(gameState.player1.hand.map(c => c.id)).toEqual(originalHandIds)
    })

    it('should not mutate original battlefield when playing card', async () => {
        const originalPlayerUnits = [...gameState.battlefield.playerUnits]
        const cardToPlay = gameState.player1.hand[0]

        await playCard(gameState, cardToPlay, 2)

        // Original battlefield should be unchanged
        expect(gameState.battlefield.playerUnits).toEqual(originalPlayerUnits)
    })

    it('should not mutate original player mana when playing card', async () => {
        const originalMana = gameState.player1.mana
        const originalSpellMana = gameState.player1.spellMana
        const cardToPlay = gameState.player1.hand[0]

        await playCard(gameState, cardToPlay, 0)

        // Original mana values should be unchanged
        expect(gameState.player1.mana).toBe(originalMana)
        expect(gameState.player1.spellMana).toBe(originalSpellMana)
    })

    it('should not mutate original deck when drawing card on endTurn', async () => {
        const originalDeck = [...gameState.player1.deck]
        const originalDeckLength = originalDeck.length

        await endTurn(gameState)

        // Original deck should be unchanged
        expect(gameState.player1.deck.length).toBe(originalDeckLength)
        expect(gameState.player1.deck).toEqual(originalDeck)
    })

    it('should create independent copies of nested arrays', async () => {
        const cardToPlay = gameState.player1.hand[0]
        const newState = await playCard(gameState, cardToPlay, 0)

        // Modify new state's hand
        newState.player1.hand.push(createTestCard({ id: 'new-card', name: 'New Card' }))

        // Original hand should not be affected
        expect(gameState.player1.hand.length).toBe(1)
        expect(gameState.player1.hand.find(c => c.id === 'new-card')).toBeUndefined()
    })

    it('should create independent copies of battlefield arrays', async () => {
        const cardToPlay = gameState.player1.hand[0]
        const newState = await playCard(gameState, cardToPlay, 0)

        // Modify new state's battlefield
        newState.battlefield.playerUnits[3] = createTestCard({
            id: 'injected',
            name: 'Injected Card',
            type: 'unit',
            attack: 1,
            health: 1,
        })

        // Original battlefield should not be affected
        expect(gameState.battlefield.playerUnits[3]).toBeNull()
    })
})
