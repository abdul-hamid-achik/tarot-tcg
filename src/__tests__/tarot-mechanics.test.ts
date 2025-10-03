import { describe, it, expect, beforeEach, vi } from 'vitest'
import { playCard } from '@/lib/game_logic'
import { declareAttack } from '@/lib/combat_logic'
import { createTestGameState, createTestCard, placeUnitsOnBattlefield } from '@/test_utils'
import type { GameState } from '@/schemas/schema'

// Mock Math.random for predictable orientation tests
const mockRandom = vi.spyOn(Math, 'random')

describe('Tarot Mechanics', () => {
    let gameState: GameState

    beforeEach(() => {
        gameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1'
        })
        mockRandom.mockReset()
    })

    describe('Orientation System (50% reversed chance)', () => {
        it('should preserve reversed state when card is played', async () => {
            // Cards have their orientation set when drawn, so we test that playing preserves it
            const card = createTestCard({
                id: 'test-card',
                name: 'The Fool',
                type: 'unit',
                isReversed: true, // Already reversed when drawn
                reversedDescription: 'Reversed effect: Draw a card'
            })

            // Add card to player's hand
            gameState.player1.hand = [card]

            const newState = await playCard(gameState, card, 0)

            // Check that unit was placed on battlefield with preserved reversed state
            const placedUnit = newState.battlefield.playerUnits[0]
            expect(placedUnit).toBeTruthy()
            expect(placedUnit?.isReversed).toBe(true)
        })

        it('should preserve upright state when card is played', async () => {
            // Cards have their orientation set when drawn
            const card = createTestCard({
                id: 'test-card',
                name: 'The Magician',
                type: 'unit',
                isReversed: false // Upright when drawn
            })

            gameState.player1.hand = [card]

            const newState = await playCard(gameState, card, 0)

            const placedUnit = newState.battlefield.playerUnits[0]
            expect(placedUnit).toBeTruthy()
            expect(placedUnit?.isReversed).toBe(false)
        })

        it('should preserve orientation across multiple card plays', async () => {
            // Test that orientation set when drawn is preserved through playing
            const results: boolean[] = []

            for (let i = 0; i < 10; i++) {
                // Alternate between reversed and upright (simulating draw orientation)
                const isReversed = i % 2 === 0
                const card = createTestCard({
                    id: `test-card-${i}`,
                    name: `Test Card ${i}`,
                    type: 'unit',
                    isReversed
                })

                const testState = createTestGameState()
                testState.player1.hand = [card]

                const newState = await playCard(testState, card, 0)
                const placedUnit = newState.battlefield.playerUnits[0]
                results.push(placedUnit?.isReversed || false)
            }

            const reversedCount = results.filter(r => r).length
            expect(reversedCount).toBe(5) // Exactly 50% with our alternating pattern
        })
    })

    describe('Zodiac Buff System', () => {
        it('should apply zodiac buff when card zodiac matches current season', async () => {
            // Mock current date to March (Aries season)
            const mockDate = new Date(2024, 2, 15) // March 15th
            vi.setSystemTime(mockDate)

            const ariesCard = createTestCard({
                id: 'aries-card',
                name: 'Aries Warrior',
                zodiacClass: 'aries',
                attack: 3,
                health: 2,
                type: 'unit'
            })

            gameState.player1.hand = [ariesCard]
            mockRandom.mockReturnValue(0.7) // Upright

            const newState = await playCard(gameState, ariesCard, 0)

            const placedUnit = newState.battlefield.playerUnits[0]
            expect(placedUnit).toBeTruthy()
            expect(placedUnit?.attack).toBe(4) // 3 + 1 zodiac buff
            expect(placedUnit?.health).toBe(3) // 2 + 1 zodiac buff
            expect(placedUnit?.astrologyBonus).toBe(1)
        })

        it('should not apply zodiac buff when card zodiac does not match season', async () => {
            // Mock current date to March (Aries season)
            const mockDate = new Date(2024, 2, 15) // March 15th
            vi.setSystemTime(mockDate)

            const leoCard = createTestCard({
                id: 'leo-card',
                name: 'Leo Guardian',
                zodiacClass: 'leo',
                attack: 4,
                health: 3,
                type: 'unit'
            })

            gameState.player1.hand = [leoCard]
            mockRandom.mockReturnValue(0.7) // Upright

            const newState = await playCard(gameState, leoCard, 0)

            const placedUnit = newState.battlefield.playerUnits[0]
            expect(placedUnit).toBeTruthy()
            expect(placedUnit?.attack).toBe(4) // No buff applied
            expect(placedUnit?.health).toBe(3) // No buff applied
            expect(placedUnit?.astrologyBonus).toBe(0)
        })
    })

    describe('Direct Combat System', () => {
        beforeEach(() => {
            // Setup battlefield with attacking and defending units
            gameState = placeUnitsOnBattlefield(gameState, 'player1', [
                {
                    id: 'attacker-1',
                    name: 'Fire Elemental',
                    attack: 4,
                    health: 3,
                    currentHealth: 3,
                    hasSummoningSickness: false,
                    hasAttackedThisTurn: false
                }
            ])

            gameState = placeUnitsOnBattlefield(gameState, 'player2', [
                {
                    id: 'defender-1',
                    name: 'Water Spirit',
                    attack: 2,
                    health: 5,
                    currentHealth: 5,
                    hasSummoningSickness: false,
                    hasAttackedThisTurn: false
                }
            ])

            gameState.player1.hasAttackToken = true
        })

        it('should handle direct unit vs unit combat with simultaneous damage', async () => {
            const newState = await declareAttack(gameState, {
                attackerId: 'attacker-1',
                targetType: 'unit',
                targetId: 'defender-1'
            })

            const attacker = newState.battlefield.playerUnits[0]
            const defender = newState.battlefield.enemyUnits[0]

            // Attacker takes 2 damage from defender (3 - 2 = 1 health remaining)
            expect(attacker?.currentHealth).toBe(1)
            expect(attacker?.hasAttackedThisTurn).toBe(true)

            // Defender takes 4 damage from attacker (5 - 4 = 1 health remaining)
            expect(defender?.currentHealth).toBe(1)
        })

        it('should handle unit death in combat', async () => {
            // Modify attacker to have enough damage to kill defender
            gameState.battlefield.playerUnits[0]!.attack = 5

            const newState = await declareAttack(gameState, {
                attackerId: 'attacker-1',
                targetType: 'unit',
                targetId: 'defender-1'
            })

            // Attacker survives with 1 health (3 - 2 = 1)
            expect(newState.battlefield.playerUnits[0]?.currentHealth).toBe(1)

            // Defender dies (5 damage >= 5 health)
            expect(newState.battlefield.enemyUnits[0]).toBeNull()
        })

        it('should handle face damage attacks', async () => {
            const initialHealth = gameState.player2.health

            const newState = await declareAttack(gameState, {
                attackerId: 'attacker-1',
                targetType: 'player'
            })

            // Player 2 should take damage equal to attacker's attack value
            expect(newState.player2.health).toBe(initialHealth - 4)

            // Attacker should be marked as having attacked
            expect(newState.battlefield.playerUnits[0]?.hasAttackedThisTurn).toBe(true)
        })

        it('should prevent attacking with summoning sickness', async () => {
            // Set attacker to have summoning sickness
            gameState.battlefield.playerUnits[0]!.hasSummoningSickness = true

            await expect(
                declareAttack(gameState, {
                    attackerId: 'attacker-1',
                    targetType: 'player'
                })
            ).rejects.toThrow('Summoning sickness')
        })

        it('should prevent attacking twice in one turn', async () => {
            // Mark attacker as having already attacked
            gameState.battlefield.playerUnits[0]!.hasAttackedThisTurn = true

            await expect(
                declareAttack(gameState, {
                    attackerId: 'attacker-1',
                    targetType: 'player'
                })
            ).rejects.toThrow('Already attacked')
        })
    })

    describe('Taunt Mechanic', () => {
        it('should force attacks to target taunt units first', async () => {
            // Setup gamestate with attacker first
            const tauntGameState = placeUnitsOnBattlefield(gameState, 'player1', [
                {
                    id: 'attacker-1',
                    name: 'Fire Elemental',
                    attack: 4,
                    health: 3,
                    hasSummoningSickness: false,
                    hasAttackedThisTurn: false
                }
            ])

            // Add a taunt unit to enemy field
            const finalState = placeUnitsOnBattlefield(tauntGameState, 'player2', [
                {
                    id: 'taunt-guardian',
                    name: 'Taunt Guardian',
                    attack: 1,
                    health: 6,
                    keywords: ['taunt']
                }
            ])

            finalState.player1.hasAttackToken = true

            // Try to attack player directly when taunt unit exists
            await expect(
                declareAttack(finalState, {
                    attackerId: 'attacker-1',
                    targetType: 'player'
                })
            ).rejects.toThrow('Must attack taunt first')
        })
    })
})

describe('Battlefield System Integration', () => {
    it('should maintain battlefield state integrity', () => {
        const gameState = createTestGameState()
        const testState = placeUnitsOnBattlefield(gameState, 'player1', [
            { name: 'Unit 1', attack: 2, health: 3 },
            { name: 'Unit 2', attack: 3, health: 2 }
        ])

        // Verify units are placed correctly
        expect(testState.battlefield.playerUnits[0]?.name).toBe('Unit 1')
        expect(testState.battlefield.playerUnits[1]?.name).toBe('Unit 2')
        expect(testState.battlefield.playerUnits[2]).toBeNull()

        // Verify no bench arrays remain
        expect((testState.player1 as any).bench).toBeUndefined()
        expect((testState.player2 as any).bench).toBeUndefined()
    })
})
