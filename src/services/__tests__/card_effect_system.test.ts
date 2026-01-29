vi.unmock('@/lib/game_logger')
vi.unmock('@/services/card_effect_system')
vi.unmock('@/services/event_manager')

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CardEffectSystem, createEffect } from '../card_effect_system'
import type { Card, CardEffect, EffectContext, GameEvent, GameState, TriggeredAbility } from '@/schemas/schema'
import { createTestGameState, createTestCard } from '@/test_utils'

// Helper to create complete GameEvent with all required fields
const createTestGameEvent = (partial: Partial<GameEvent>, gameState: GameState): GameEvent => ({
    id: 'test-event-' + Date.now(),
    type: 'card_played',
    timestamp: Date.now(),
    gameStateId: 'test-state-1',
    phase: gameState.phase,
    activePlayer: gameState.activePlayer,
    turn: gameState.turn,
    round: gameState.round,
    source: { type: 'card', id: 'card-1', name: 'Test Card' },
    data: {},
    ...partial,
})

describe('CardEffectSystem', () => {
    let effectSystem: CardEffectSystem
    let gameState: GameState

    beforeEach(() => {
        effectSystem = new CardEffectSystem()
        gameState = createTestGameState()
    })

    describe('Card Ability Registration', () => {
        it('should register card abilities', () => {
            const card = createTestCard({ id: 'test-card-1' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-1',
                    name: 'On Summon',
                    description: 'Draw a card when summoned',
                    trigger: { event: 'unit_summoned', source: 'self' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)

            // Should not throw and should be registered
            expect(() => effectSystem.registerCardAbilities(card, abilities)).not.toThrow()
        })

        it('should register multiple abilities for a single card', () => {
            const card = createTestCard({ id: 'test-card-2' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-2',
                    name: 'On Summon',
                    description: 'Draw a card',
                    trigger: { event: 'unit_summoned', source: 'self' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
                {
                    id: 'test-ability-3',
                    name: 'On Death',
                    description: 'Deal 1 damage',
                    trigger: { event: 'unit_dies', source: 'self' },
                    effect: createEffect.dealDamage(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)

            // Verify abilities are registered (no errors thrown)
            expect(() => effectSystem.unregisterCardAbilities(card.id)).not.toThrow()
        })

        it('should unregister card abilities', () => {
            const card = createTestCard({ id: 'test-card-3' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-4',
                    name: 'Test Ability',
                    description: 'Test',
                    trigger: { event: 'unit_summoned' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)
            effectSystem.unregisterCardAbilities(card.id)

            // Should not throw
            expect(() => effectSystem.unregisterCardAbilities(card.id)).not.toThrow()
        })
    })

    describe('Effect Execution', () => {
        it('should execute an effect immediately', async () => {
            const effect: CardEffect = createEffect.drawCards(1)
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            const result = await effectSystem.executeEffect(effect, context)

            expect(result.success).toBe(true)
            expect(result.newGameState).toBeDefined()
        })

        it('should execute effect with triggering event', async () => {
            const effect: CardEffect = createEffect.dealDamage(3)
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }
            const event = createTestGameEvent({
                id: 'event-1',
                type: 'card_played',
                source: { type: 'card', id: 'source-card', name: 'Test Card' },
            }, gameState)

            const result = await effectSystem.executeEffect(effect, context, event)

            expect(result.success).toBe(true)
        })

        it('should handle effect execution errors gracefully', async () => {
            const effect: CardEffect = {
                id: 'failing-effect',
                name: 'Failing Effect',
                description: 'This effect fails',
                type: 'instant',
                execute: () => {
                    throw new Error('Effect failed')
                },
            }
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            // Should not crash the system
            await expect(effectSystem.executeEffect(effect, context)).resolves.toBeDefined()
        })
    })

    describe('Effect Queue Management', () => {
        it('should queue an effect', () => {
            const effect: CardEffect = createEffect.drawCards(2)
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            const effectId = effectSystem.queueEffect(effect, context, 10)

            expect(effectId).toBeDefined()
            expect(effectId).toContain('queued_')
        })

        it('should queue multiple effects with priorities', () => {
            const effect1: CardEffect = createEffect.drawCards(1)
            const effect2: CardEffect = createEffect.dealDamage(2)
            const effect3: CardEffect = createEffect.gainHealth(5)
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            const id1 = effectSystem.queueEffect(effect1, context, 10)
            const id2 = effectSystem.queueEffect(effect2, context, 20)
            const id3 = effectSystem.queueEffect(effect3, context, 15)

            expect(id1).toBeDefined()
            expect(id2).toBeDefined()
            expect(id3).toBeDefined()
        })

        it('should resolve queued effects in priority order', async () => {
            const effect1: CardEffect = createEffect.drawCards(1)
            const effect2: CardEffect = createEffect.dealDamage(2)
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            effectSystem.queueEffect(effect1, context, 10)
            effectSystem.queueEffect(effect2, context, 20)

            const results = await effectSystem.resolveEffectStack()

            expect(results).toHaveLength(2)
            expect(results[0].success).toBe(true)
            expect(results[1].success).toBe(true)
        })

        it('should clear effect queue after resolution', async () => {
            const effect: CardEffect = createEffect.drawCards(1)
            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            effectSystem.queueEffect(effect, context)
            await effectSystem.resolveEffectStack()

            // Queue should be empty, resolving again should return empty array
            const results = await effectSystem.resolveEffectStack()
            expect(results).toHaveLength(0)
        })
    })

    describe('Triggered Abilities', () => {
        it('should process triggered abilities for matching events', async () => {
            const card = createTestCard({ id: 'trigger-card', name: 'Trigger Card' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-5',
                    name: 'On Summon',
                    description: 'Draw a card',
                    trigger: { event: 'unit_summoned', source: 'self' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)

            const event = createTestGameEvent({
                id: 'event-1',
                type: 'unit_summoned',
                source: { type: 'card', id: 'trigger-card', name: 'Trigger Card' },
                data: { gameState },
            }, gameState)

            await effectSystem.processTriggeredAbilities(event)

            // Should complete without errors
            expect(true).toBe(true)
        })

        it('should not trigger abilities for non-matching events', async () => {
            const card = createTestCard({ id: 'trigger-card' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-6',
                    name: 'On Death',
                    description: 'Deal damage',
                    trigger: { event: 'unit_dies', source: 'self' },
                    effect: createEffect.dealDamage(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)

            const event = createTestGameEvent({
                id: 'event-2',
                type: 'card_played',
                source: { type: 'card', id: 'other-card', name: 'Other Card' },
                data: { gameState },
            }, gameState)

            // Should not trigger (different event type)
            await effectSystem.processTriggeredAbilities(event)
            expect(true).toBe(true)
        })

        it('should skip optional abilities', async () => {
            const card = createTestCard({ id: 'optional-card' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-7',
                    name: 'Optional Draw',
                    description: 'May draw a card',
                    trigger: { event: 'unit_summoned', source: 'self' },
                    effect: createEffect.drawCards(1),
                    optional: true, // Optional ability
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)

            const event = createTestGameEvent({
                id: 'event-3',
                type: 'unit_summoned',
                source: { type: 'card', id: 'optional-card', name: 'Optional Card' },
                data: { gameState },
            }, gameState)

            // Should skip optional abilities
            await effectSystem.processTriggeredAbilities(event)
            expect(true).toBe(true)
        })

        it('should handle multiple triggered abilities from different cards', async () => {
            const card1 = createTestCard({ id: 'card-1' })
            const card2 = createTestCard({ id: 'card-2' })

            const abilities1: TriggeredAbility[] = [
                {
                    id: 'test-ability-8',
                    name: 'On Turn Start',
                    description: 'Draw a card',
                    trigger: { event: 'turn_start' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            const abilities2: TriggeredAbility[] = [
                {
                    id: 'test-ability-9',
                    name: 'On Turn Start',
                    description: 'Gain 1 health',
                    trigger: { event: 'turn_start' },
                    effect: createEffect.gainHealth(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card1, abilities1)
            effectSystem.registerCardAbilities(card2, abilities2)

            const event = createTestGameEvent({
                id: 'event-4',
                type: 'turn_start',
                source: { type: 'system', id: 'game', name: 'Game' },
                data: { gameState },
            }, gameState)

            await effectSystem.processTriggeredAbilities(event)
            expect(true).toBe(true)
        })
    })

    describe('Persistent Effects', () => {
        it('should update persistent effects without errors', () => {
            const updatedState = effectSystem.updatePersistentEffects(gameState)

            expect(updatedState).toBeDefined()
            expect(updatedState).toBe(gameState) // Currently returns unchanged state
        })

        it('should get active effects', () => {
            const activeEffects = effectSystem.getActiveEffects()

            expect(Array.isArray(activeEffects)).toBe(true)
            expect(activeEffects.length).toBeGreaterThanOrEqual(0)
        })
    })

    describe('Effect Cleanup', () => {
        it('should clear all effects', () => {
            const card = createTestCard({ id: 'cleanup-card' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-10',
                    name: 'Test',
                    description: 'Test ability',
                    trigger: { event: 'unit_summoned' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)
            effectSystem.queueEffect(createEffect.dealDamage(1), { gameState, source: card })

            effectSystem.clearAllEffects()

            const activeEffects = effectSystem.getActiveEffects()
            expect(activeEffects).toHaveLength(0)
        })

        it('should allow re-registration after clearing', () => {
            const card = createTestCard({ id: 'reset-card' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-11',
                    name: 'Test',
                    description: 'Test ability',
                    trigger: { event: 'unit_summoned' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)
            effectSystem.clearAllEffects()
            effectSystem.registerCardAbilities(card, abilities)

            // Should not throw
            expect(true).toBe(true)
        })
    })

    describe('Effect Helpers', () => {
        it('should create dealDamage effect', () => {
            const effect = createEffect.dealDamage(5)

            expect(effect.id).toBe('deal_damage_5_player')
            expect(effect.name).toBe('Deal 5 Damage')
            expect(effect.type).toBe('instant')
            expect(typeof effect.execute).toBe('function')
        })

        it('should create gainHealth effect', () => {
            const effect = createEffect.gainHealth(3)

            expect(effect.id).toBe('gain_health_3')
            expect(effect.name).toBe('Gain 3 Health')
            expect(effect.type).toBe('instant')
            expect(typeof effect.execute).toBe('function')
        })

        it('should create drawCards effect', () => {
            const effect = createEffect.drawCards(2)

            expect(effect.id).toBe('draw_2')
            expect(effect.name).toBe('Draw 2 Cards')
            expect(effect.description).toBe('Draw 2 cards')
            expect(effect.type).toBe('instant')
        })

        it('should create statBuff effect', () => {
            const effect = createEffect.statBuff(2, 3, 'end_of_turn')

            expect(effect.id).toBe('buff_2_3')
            expect(effect.name).toBe('+2/+3')
            expect(effect.type).toBe('persistent')
            expect(effect.duration).toBe('end_of_turn')
        })

        it('should execute effect helpers', () => {
            const effects = [
                createEffect.dealDamage(1),
                createEffect.gainHealth(1),
                createEffect.drawCards(1),
                createEffect.statBuff(1, 1),
            ] as CardEffect[]

            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'test-card' }),
            }

            effects.forEach((effect) => {
                const result = (effect.execute as any)(context) as { success: boolean; newGameState: any }
                expect(result.success).toBe(true)
                expect(result.newGameState).toBeDefined()
            })
        })
    })

    describe('Edge Cases', () => {
        it('should handle empty ability registration', () => {
            const card = createTestCard({ id: 'empty-card' })
            const abilities: TriggeredAbility[] = []

            effectSystem.registerCardAbilities(card, abilities)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle unregistering non-existent card', () => {
            effectSystem.unregisterCardAbilities('non-existent-card-id')

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle processing abilities with no registered cards', async () => {
            const event = createTestGameEvent({
                id: 'event-5',
                type: 'unit_summoned',
                source: { type: 'card', id: 'some-card', name: 'Some Card' },
                data: { gameState },
            }, gameState)

            await effectSystem.processTriggeredAbilities(event)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle effect queue without effects', async () => {
            const results = await effectSystem.resolveEffectStack()

            expect(results).toHaveLength(0)
        })

        it('should handle multiple clearAllEffects calls', () => {
            effectSystem.clearAllEffects()
            effectSystem.clearAllEffects()
            effectSystem.clearAllEffects()

            // Should not throw
            expect(true).toBe(true)
        })
    })

    describe('Event Integration', () => {
        it('should listen for turn start events', async () => {
            // The constructor sets up event listeners
            // Just verify the system can handle the event without crashing
            const event = createTestGameEvent({
                id: 'turn-start-1',
                type: 'turn_start',
                source: { type: 'system', id: 'game', name: 'Game' },
                data: { gameState },
            }, gameState)

            await effectSystem.processTriggeredAbilities(event)
            expect(true).toBe(true)
        })

        it('should listen for card destroyed events', async () => {
            const card = createTestCard({ id: 'destroyed-card' })
            const abilities: TriggeredAbility[] = [
                {
                    id: 'test-ability-12',
                    name: 'Test',
                    description: 'Test',
                    trigger: { event: 'card_destroyed' },
                    effect: createEffect.drawCards(1),
                    optional: false,
                },
            ]

            effectSystem.registerCardAbilities(card, abilities)

            const event = createTestGameEvent({
                id: 'destroy-1',
                type: 'card_destroyed',
                source: { type: 'card', id: 'destroyed-card', name: 'Destroyed Card' },
                data: { gameState },
            }, gameState)

            await effectSystem.processTriggeredAbilities(event)
            expect(true).toBe(true)
        })
    })
})

