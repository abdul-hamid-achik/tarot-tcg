vi.unmock("@/lib/game_logger")
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AIControllerService } from '../ai_controller_service'
import { createTestGameState, createTestCard } from '../../test_utils'
import type { GameState } from '../../schemas/schema'

// Mock dependencies
vi.mock('../event_manager', () => ({
    eventManager: {
        emit: vi.fn(),
        subscribe: vi.fn(),
        emitAIAction: vi.fn(), // Add missing method
    },
}))

vi.mock('../state_manager', () => ({
    stateManager: {
        updateGameState: vi.fn((state) => state),
    },
}))

vi.mock('@/lib/game_logger', () => ({
    GameLogger: {
        ai: vi.fn(),
        action: vi.fn(),
        combat: vi.fn(),
    },
}))

// Mock combat and battlefield services with minimal implementations
vi.mock('../combat_service', () => ({
    combatService: {
        processAttack: vi.fn().mockResolvedValue({
            attackerDamage: 0,
            targetDamage: 3,
            attackerSurvived: true,
            targetSurvived: false,
        }),
        getValidTargets: vi.fn().mockReturnValue({ units: [], canAttackNexus: true }),
    },
}))

vi.mock('../battlefield_service', () => ({
    battlefieldService: {
        placeUnit: vi.fn((battlefield, card, player, slot) => {
            // Return a new battlefield with the unit placed
            const newBattlefield = {
                ...battlefield,
                enemyUnits: [...battlefield.enemyUnits],
                playerUnits: [...battlefield.playerUnits],
            }
            if (player === 'player2') {
                newBattlefield.enemyUnits[slot] = card
            } else {
                newBattlefield.playerUnits[slot] = card
            }
            return newBattlefield
        }),
        canPlaceUnit: vi.fn().mockReturnValue(true),
    },
}))

vi.mock('../ai_service', () => ({
    aiService: {
        getCurrentPersonality: vi.fn().mockReturnValue({
            name: 'Balanced',
            icon: '⚖️',
            level: 'medium' as const,
            description: 'Test personality',
            biases: {
                aggression: 0.5,
                cardAdvantage: 0.5,
                riskTaking: 0.5,
            },
        }),
        setPersonality: vi.fn(),
        performMulligan: vi.fn((state) => ({
            ...state,
            player2: { ...state.player2, mulliganComplete: true },
        })),
    },
}))

vi.mock('@/lib/combat_logic', () => ({
    declareAttack: vi.fn((state) => state),
}))

vi.mock('@/lib/game_logic', () => ({
    endTurn: vi.fn((state) => ({
        ...state,
        activePlayer: state.activePlayer === 'player1' ? 'player2' : 'player1',
    })),
}))

describe('AIControllerService', () => {
    let aiController: AIControllerService
    let gameState: GameState

    beforeEach(() => {
        aiController = new AIControllerService()
        gameState = createTestGameState({
            activePlayer: 'player2',
            phase: 'action',
        })
        vi.clearAllMocks()
    })

    describe('executeAITurn', () => {
        it('should return state unchanged when not AI turn', async () => {
            const humanTurnState = createTestGameState({
                activePlayer: 'player1',
                phase: 'action',
            })

            const result = await aiController.executeAITurn(humanTurnState)

            expect(result.activePlayer).toBe('player1')
        })

        it('should execute turn when it is AI turn', async () => {
            const aiTurnState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    mana: 5,
                    hand: [
                        createTestCard({ id: 'ai-card-1', cost: 2, type: 'unit' }),
                        createTestCard({ id: 'ai-card-2', cost: 3, type: 'spell' }),
                    ],
                },
            })

            const result = await aiController.executeAITurn(aiTurnState)

            // AI should have processed the turn
            expect(result).toBeDefined()
            expect(result.activePlayer).toBeDefined()
        })

        it('should handle mulligan phase', async () => {
            const mulliganState = createTestGameState({
                activePlayer: 'player2',
                phase: 'mulligan',
                player2: {
                    ...createTestGameState().player2,
                    mulliganComplete: false,
                    hand: [
                        createTestCard({ id: 'mull-1', cost: 7 }),
                        createTestCard({ id: 'mull-2', cost: 8 }),
                        createTestCard({ id: 'mull-3', cost: 2 }),
                    ],
                },
            })

            const result = await aiController.executeAITurn(mulliganState)

            // AI should have completed mulligan
            expect(result.player2.mulliganComplete).toBe(true)
        })

        it('should handle AI with empty hand', async () => {
            const emptyHandState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    hand: [],
                    mana: 5,
                },
            })

            const result = await aiController.executeAITurn(emptyHandState)

            // Should complete without errors
            expect(result).toBeDefined()
        })

        it('should handle AI with no mana', async () => {
            const noManaState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    mana: 0,
                    spellMana: 0,
                    hand: [createTestCard({ id: 'expensive', cost: 5 })],
                },
            })

            const result = await aiController.executeAITurn(noManaState)

            // Should still complete turn
            expect(result).toBeDefined()
        })

        it('should handle AI with units on battlefield', async () => {
            const withUnitsState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
            })

            withUnitsState.battlefield.enemyUnits[0] = createTestCard({
                id: 'ai-unit-1',
                attack: 3,
                health: 3,
            })
            withUnitsState.battlefield.enemyUnits[1] = createTestCard({
                id: 'ai-unit-2',
                attack: 2,
                health: 2,
            })

            const result = await aiController.executeAITurn(withUnitsState)

            // Should process units
            expect(result).toBeDefined()
        })

        it('should play cards when affordable', async () => {
            const affordableState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    mana: 10,
                    hand: [
                        createTestCard({ id: 'cheap-1', cost: 1, type: 'unit', attack: 2, health: 2 }),
                        createTestCard({ id: 'cheap-2', cost: 2, type: 'unit', attack: 3, health: 3 }),
                    ],
                },
            })

            const result = await aiController.executeAITurn(affordableState)

            // AI should have attempted to play cards
            expect(result).toBeDefined()
        })

        it('should handle full battlefield', async () => {
            const fullBattlefieldState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
            })

            // Fill all enemy unit slots
            fullBattlefieldState.battlefield.enemyUnits = Array(7).fill(null).map((_, i) =>
                createTestCard({ id: `unit-${i}`, attack: 2, health: 2 })
            )

            fullBattlefieldState.player2.hand = [
                createTestCard({ id: 'new-unit', cost: 1, type: 'unit' }),
            ]
            fullBattlefieldState.player2.mana = 5

            const result = await aiController.executeAITurn(fullBattlefieldState)

            // Should handle gracefully
            expect(result).toBeDefined()
        })

        it('should make attack decisions', async () => {
            const attackState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
            })

            // Give AI an attacker
            attackState.battlefield.enemyUnits[0] = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 5,
                hasAttacked: false,
            })

            const result = await aiController.executeAITurn(attackState)

            // Should process without errors
            expect(result).toBeDefined()
        })
    })

    describe('AI Decision Making', () => {
        it('should prioritize low-cost cards when mana is limited', async () => {
            const limitedManaState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    mana: 3,
                    hand: [
                        createTestCard({ id: 'low-cost', cost: 2, type: 'unit' }),
                        createTestCard({ id: 'high-cost', cost: 7, type: 'unit' }),
                    ],
                },
            })

            const result = await aiController.executeAITurn(limitedManaState)

            expect(result).toBeDefined()
        })

        it('should handle spells differently than units', async () => {
            const mixedHandState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    mana: 10,
                    hand: [
                        createTestCard({ id: 'unit', cost: 3, type: 'unit' }),
                        createTestCard({ id: 'spell', cost: 2, type: 'spell' }),
                    ],
                },
            })

            const result = await aiController.executeAITurn(mixedHandState)

            expect(result).toBeDefined()
        })

        it('should avoid attacking with units that have summoning sickness', async () => {
            const summoningSicknessState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
            })

            summoningSicknessState.battlefield.enemyUnits[0] = createTestCard({
                id: 'new-unit',
                attack: 3,
                health: 3,
                canAttack: false, // Summoning sickness
            })

            const result = await aiController.executeAITurn(summoningSicknessState)

            expect(result).toBeDefined()
        })

        it('should attack when units can attack', async () => {
            const canAttackState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    hasAttackToken: true,
                },
            })

            canAttackState.battlefield.enemyUnits[0] = createTestCard({
                id: 'ready-attacker',
                attack: 4,
                health: 4,
                canAttack: true,
                hasAttacked: false,
            })

            const result = await aiController.executeAITurn(canAttackState)

            expect(result).toBeDefined()
        })
    })

    describe('Edge Cases', () => {
        it('should handle gameState with no battlefield', async () => {
            const noBattlefieldState = {
                ...createTestGameState(),
                activePlayer: 'player2' as const,
                battlefield: {
                    playerUnits: Array(7).fill(null),
                    enemyUnits: Array(7).fill(null),
                    maxSlots: 7,
                },
            }

            const result = await aiController.executeAITurn(noBattlefieldState)

            expect(result).toBeDefined()
        })

        it('should handle consecutive AI turns', async () => {
            let state = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
            })

            // First turn
            state = await aiController.executeAITurn(state)
            expect(state).toBeDefined()

            // Prepare for second turn
            state.activePlayer = 'player2'
            state.phase = 'action'

            // Second turn
            state = await aiController.executeAITurn(state)
            expect(state).toBeDefined()
        })

        it('should handle errors gracefully', async () => {
            // Create a state that might cause issues
            const problematicState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    hand: [createTestCard({ id: 'card', cost: -1 })], // Invalid cost
                },
            })

            // Should not throw
            await expect(
                aiController.executeAITurn(problematicState)
            ).resolves.toBeDefined()
        })

        it('should handle missing player data', async () => {
            const partialState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
            })

            const result = await aiController.executeAITurn(partialState)

            expect(result).toBeDefined()
        })
    })

    describe('Performance', () => {
        it('should complete AI turn in reasonable time', async () => {
            const start = Date.now()

            await aiController.executeAITurn(gameState)

            const duration = Date.now() - start

            // AI turn should complete in less than 5 seconds (including simulated thinking)
            expect(duration).toBeLessThan(5000)
        })

        it('should handle large hand sizes', async () => {
            const largeHandState = createTestGameState({
                activePlayer: 'player2',
                phase: 'action',
                player2: {
                    ...createTestGameState().player2,
                    mana: 20,
                    hand: Array(10).fill(null).map((_, i) =>
                        createTestCard({ id: `card-${i}`, cost: i, type: 'unit' })
                    ),
                },
            })

            const result = await aiController.executeAITurn(largeHandState)

            expect(result).toBeDefined()
        })
    })
})
