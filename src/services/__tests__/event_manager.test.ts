vi.unmock("@/lib/game_logger")
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Unmock event_manager for this test file - we need to test the real implementation
vi.unmock('../event_manager')
vi.unmock('@/services/event_manager')

import { EventManager, createEventHelpers, eventManager as singletonEventManager } from '../event_manager'
import { createTestGameState } from '../../test_utils'
import type { GameEvent, GameEventType, GameState } from '../../schemas/schema'

describe('EventManager', () => {
    let eventManager: EventManager
    let gameState: GameState

    beforeEach(() => {
        eventManager = new EventManager()
        gameState = createTestGameState()
    })

    describe('Subscription Management', () => {
        it('should subscribe to events and return subscription ID', () => {
            const listener = vi.fn()
            const subId = eventManager.subscribe({ types: ['card_played'] }, listener)

            expect(subId).toBeDefined()
            expect(subId).toMatch(/^sub_/)
        })

        it('should unsubscribe from events', () => {
            const listener = vi.fn()
            const subId = eventManager.subscribe({ types: ['card_played'] }, listener)

            const result = eventManager.unsubscribe(subId)

            expect(result).toBe(true)
            expect(eventManager.getActiveSubscriptions()).toHaveLength(0)
        })

        it('should return false when unsubscribing non-existent subscription', () => {
            const result = eventManager.unsubscribe('non-existent-id')

            expect(result).toBe(false)
        })

        it('should track multiple subscriptions', () => {
            eventManager.subscribe({ types: ['card_played'] }, vi.fn())
            eventManager.subscribe({ types: ['card_drawn'] }, vi.fn())
            eventManager.subscribe({ types: ['unit_summoned'] }, vi.fn())

            expect(eventManager.getActiveSubscriptions()).toHaveLength(3)
        })

        it('should clear all subscriptions', () => {
            eventManager.subscribe({ types: ['card_played'] }, vi.fn())
            eventManager.subscribe({ types: ['card_drawn'] }, vi.fn())

            eventManager.clearSubscriptions()

            expect(eventManager.getActiveSubscriptions()).toHaveLength(0)
        })
    })

    describe('Event Emission', () => {
        it('should emit events to matching listeners', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['card_played'] }, listener)

            await eventManager.emit('card_played', gameState, { cardId: 'test-card' })

            expect(listener).toHaveBeenCalledTimes(1)
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'card_played',
                    data: { cardId: 'test-card' },
                })
            )
        })

        it('should not call listeners that don\'t match event type', async () => {
            const cardListener = vi.fn()
            const drawListener = vi.fn()

            eventManager.subscribe({ types: ['card_played'] }, cardListener)
            eventManager.subscribe({ types: ['card_drawn'] }, drawListener)

            await eventManager.emit('card_played', gameState, { cardId: 'test' })

            expect(cardListener).toHaveBeenCalledTimes(1)
            expect(drawListener).not.toHaveBeenCalled()
        })

        it('should call multiple listeners for same event', async () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()
            const listener3 = vi.fn()

            eventManager.subscribe({ types: ['card_played'] }, listener1)
            eventManager.subscribe({ types: ['card_played'] }, listener2)
            eventManager.subscribe({ types: ['card_played'] }, listener3)

            await eventManager.emit('card_played', gameState, { cardId: 'test' })

            expect(listener1).toHaveBeenCalledTimes(1)
            expect(listener2).toHaveBeenCalledTimes(1)
            expect(listener3).toHaveBeenCalledTimes(1)
        })

        it('should create events with proper structure', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['card_played'] }, listener)

            await eventManager.emit(
                'card_played',
                gameState,
                { cardId: 'test', cardName: 'Test Card' },
                { type: 'card', id: 'test', name: 'Test Card' },
                { type: 'player', id: 'player1', name: 'Player 1' }
            )

            const event: GameEvent = listener.mock.calls[0][0]
            expect(event).toMatchObject({
                type: 'card_played',
                phase: gameState.phase,
                activePlayer: gameState.activePlayer,
                turn: gameState.turn,
                round: gameState.round,
                source: { type: 'card', id: 'test', name: 'Test Card' },
                target: { type: 'player', id: 'player1', name: 'Player 1' },
                data: { cardId: 'test', cardName: 'Test Card' },
            })
            expect(event.id).toBeDefined()
            expect(event.timestamp).toBeDefined()
        })
    })

    describe('Event Filtering', () => {
        it('should filter events by type', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['card_played', 'card_drawn'] }, listener)

            await eventManager.emit('card_played', gameState, {})
            await eventManager.emit('unit_summoned', gameState, {})
            await eventManager.emit('card_drawn', gameState, {})

            expect(listener).toHaveBeenCalledTimes(2)
        })

        it('should filter events by source type', async () => {
            const listener = vi.fn()
            eventManager.subscribe(
                {
                    types: ['card_played'],
                    source: { type: 'card' },
                },
                listener
            )

            await eventManager.emit(
                'card_played',
                gameState,
                {},
                { type: 'card', id: 'test' }
            )
            await eventManager.emit(
                'card_played',
                gameState,
                {},
                { type: 'player', id: 'player1' }
            )

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('should filter events by source ID', async () => {
            const listener = vi.fn()
            eventManager.subscribe(
                {
                    types: ['card_played'],
                    source: { type: 'card', id: 'specific-card' },
                },
                listener
            )

            await eventManager.emit(
                'card_played',
                gameState,
                {},
                { type: 'card', id: 'specific-card' }
            )
            await eventManager.emit(
                'card_played',
                gameState,
                {},
                { type: 'card', id: 'other-card' }
            )

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('should filter events by target', async () => {
            const listener = vi.fn()
            eventManager.subscribe(
                {
                    types: ['combat_damage_dealt'],
                    target: { type: 'player', id: 'player1' },
                },
                listener
            )

            await eventManager.emit(
                'combat_damage_dealt',
                gameState,
                {},
                undefined,
                { type: 'player', id: 'player1' }
            )
            await eventManager.emit(
                'combat_damage_dealt',
                gameState,
                {},
                undefined,
                { type: 'player', id: 'player2' }
            )

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('should filter events by custom condition', async () => {
            const listener = vi.fn()
            eventManager.subscribe(
                {
                    types: ['card_played'],
                    condition: (event) => {
                        const data = event.data as any
                        return data.cost && data.cost >= 5
                    },
                },
                listener
            )

            await eventManager.emit('card_played', gameState, { cost: 7 })
            await eventManager.emit('card_played', gameState, { cost: 3 })
            await eventManager.emit('card_played', gameState, { cost: 5 })

            expect(listener).toHaveBeenCalledTimes(2)
        })
    })

    describe('Priority Handling', () => {
        it('should execute listeners in priority order (highest first)', async () => {
            const executionOrder: number[] = []

            eventManager.subscribe({ types: ['card_played'] }, async () => {
                executionOrder.push(1)
            }, { priority: 1 })

            eventManager.subscribe({ types: ['card_played'] }, async () => {
                executionOrder.push(5)
            }, { priority: 5 })

            eventManager.subscribe({ types: ['card_played'] }, async () => {
                executionOrder.push(3)
            }, { priority: 3 })

            await eventManager.emit('card_played', gameState, {})

            expect(executionOrder).toEqual([5, 3, 1])
        })

        it('should default to priority 0 if not specified', async () => {
            const executionOrder: number[] = []

            eventManager.subscribe({ types: ['card_drawn'] }, async () => {
                executionOrder.push(0)
            })

            eventManager.subscribe({ types: ['card_drawn'] }, async () => {
                executionOrder.push(5)
            }, { priority: 5 })

            await eventManager.emit('card_drawn', gameState, {})

            expect(executionOrder).toEqual([5, 0])
        })
    })

    describe('One-time Subscriptions', () => {
        it('should remove subscription after first execution when once=true', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['card_played'] }, listener, { once: true })

            await eventManager.emit('card_played', gameState, {})
            await eventManager.emit('card_played', gameState, {})

            expect(listener).toHaveBeenCalledTimes(1)
            expect(eventManager.getActiveSubscriptions()).toHaveLength(0)
        })

        it('should keep subscription when once=false', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['card_played'] }, listener, { once: false })

            await eventManager.emit('card_played', gameState, {})
            await eventManager.emit('card_played', gameState, {})

            expect(listener).toHaveBeenCalledTimes(2)
            expect(eventManager.getActiveSubscriptions()).toHaveLength(1)
        })
    })

    describe('Event History', () => {
        it('should record events in history', async () => {
            await eventManager.emit('card_played', gameState, { cardId: '1' })
            await eventManager.emit('card_drawn', gameState, { cardId: '2' })

            const history = eventManager.getHistory()

            expect(history).toHaveLength(2)
            expect(history[0].type).toBe('card_played')
            expect(history[1].type).toBe('card_drawn')
        })

        it('should filter history by event types', async () => {
            await eventManager.emit('card_played', gameState, {})
            await eventManager.emit('card_drawn', gameState, {})
            await eventManager.emit('unit_summoned', gameState, {})

            const filteredHistory = eventManager.getHistory({ types: ['card_played', 'card_drawn'] })

            expect(filteredHistory).toHaveLength(2)
        })

        it('should filter history by custom condition', async () => {
            await eventManager.emit('card_played', gameState, { cost: 5 })
            await eventManager.emit('card_played', gameState, { cost: 2 })
            await eventManager.emit('card_played', gameState, { cost: 7 })

            const expensiveCards = eventManager.getHistory({
                condition: (event) => {
                    const data = event.data as any
                    return data.cost && data.cost >= 5
                },
            })

            expect(expensiveCards).toHaveLength(2)
        })

        it('should clear event history', async () => {
            await eventManager.emit('card_played', gameState, {})
            await eventManager.emit('card_drawn', gameState, {})

            eventManager.clearHistory()

            expect(eventManager.getHistory()).toHaveLength(0)
        })

        it('should get recent events of specific type', async () => {
            await eventManager.emit('card_played', gameState, { cardId: '1' })
            await eventManager.emit('card_drawn', gameState, { cardId: '2' })
            await eventManager.emit('card_played', gameState, { cardId: '3' })
            await eventManager.emit('card_played', gameState, { cardId: '4' })

            const recentCardPlayed = eventManager.getRecentEvents('card_played', 2)

            expect(recentCardPlayed).toHaveLength(2)
            expect((recentCardPlayed[0].data as any).cardId).toBe('3')
            expect((recentCardPlayed[1].data as any).cardId).toBe('4')
        })

        it('should check if event occurred recently within turns', async () => {
            await eventManager.emit('unit_dies', { ...gameState, turn: 1 }, {})
            await eventManager.emit('card_played', { ...gameState, turn: 2 }, {})

            const hasRecentDeath = eventManager.hasRecentEvent('unit_dies', 2, 3)
            const hasOldDeath = eventManager.hasRecentEvent('unit_dies', 1, 3)

            expect(hasRecentDeath).toBe(true)
            expect(hasOldDeath).toBe(false)
        })

        it('should limit history size', async () => {
            const smallHistoryManager = new EventManager(5)

            for (let i = 0; i < 10; i++) {
                await smallHistoryManager.emit('card_drawn', gameState, { index: i })
            }

            const history = smallHistoryManager.getHistory()

            expect(history).toHaveLength(5)
            expect((history[0].data as any).index).toBe(5) // First event should be index 5
            expect((history[4].data as any).index).toBe(9) // Last event should be index 9
        })
    })

    describe('Helper Subscriptions', () => {
        it('should subscribe to card events', async () => {
            const listener = vi.fn()
            eventManager.subscribeToCard('test-card', ['card_played', 'unit_dies'], listener)

            await eventManager.emit(
                'card_played',
                gameState,
                {},
                { type: 'card', id: 'test-card' }
            )
            await eventManager.emit(
                'card_played',
                gameState,
                {},
                { type: 'card', id: 'other-card' }
            )
            await eventManager.emit(
                'unit_dies',
                gameState,
                {},
                { type: 'card', id: 'test-card' }
            )

            expect(listener).toHaveBeenCalledTimes(2)
        })

        it('should subscribe to player events', async () => {
            const listener = vi.fn()
            eventManager.subscribeToPlayer('player1', ['player_loses_health'], listener)

            await eventManager.emit(
                'player_loses_health',
                gameState,
                {},
                { type: 'player', id: 'player1' }
            )
            await eventManager.emit(
                'player_loses_health',
                gameState,
                {},
                { type: 'player', id: 'player2' }
            )

            expect(listener).toHaveBeenCalledTimes(1)
        })
    })

    describe('Convenience Emitters', () => {
        it('should emit card events with proper structure', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['card_played'] }, listener)

            await eventManager.emitCardEvent('card_played', gameState, 'card-123', 'Test Card', {
                cost: 3,
            })

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'card_played',
                    data: {
                        cardId: 'card-123',
                        cardName: 'Test Card',
                        cost: 3,
                    },
                    source: {
                        type: 'card',
                        id: 'card-123',
                        name: 'Test Card',
                    },
                })
            )
        })

        it('should emit player events with proper structure', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['player_loses_health'] }, listener)

            await eventManager.emitPlayerEvent('player_loses_health', gameState, 'player1', {
                amount: 5,
            })

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player_loses_health',
                    data: {
                        playerId: 'player1',
                        amount: 5,
                    },
                    source: {
                        type: 'player',
                        id: 'player1',
                        name: gameState.player1.name,
                    },
                })
            )
        })

        it('should emit combat events with proper structure', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['combat_start'] }, listener)

            await eventManager.emitCombatEvent('combat_start', gameState, 3, { damage: 5 })

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'combat_start',
                    data: {
                        laneId: 3,
                        damage: 5,
                    },
                    source: {
                        type: 'system',
                        id: 'combat',
                    },
                })
            )
        })

        it('should emit system events with proper structure', async () => {
            const listener = vi.fn()
            eventManager.subscribe({ types: ['phase_changed'] }, listener)

            await eventManager.emitSystemEvent('phase_changed', gameState, {
                fromPhase: 'action',
                toPhase: 'combat',
            })

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'phase_changed',
                    data: {
                        fromPhase: 'action',
                        toPhase: 'combat',
                    },
                    source: {
                        type: 'system',
                        id: 'game',
                    },
                })
            )
        })
    })

    describe('Event Queuing and Recursion Prevention', () => {
        it('should queue events emitted during event processing', async () => {
            const listener1 = vi.fn(async () => {
                // Emit another event during processing
                await eventManager.emit('secondary_event', gameState, {})
            })
            const listener2 = vi.fn()

            eventManager.subscribe({ types: ['primary_event'] }, listener1)
            eventManager.subscribe({ types: ['secondary_event'] }, listener2)

            await eventManager.emit('primary_event', gameState, {})

            expect(listener1).toHaveBeenCalledTimes(1)
            expect(listener2).toHaveBeenCalledTimes(1)
        })

        it('should process queued events in order', async () => {
            const executionOrder: string[] = []

            const listener1 = vi.fn(async () => {
                executionOrder.push('event1-handler')
                await eventManager.emit('event2', gameState, {})
                await eventManager.emit('event3', gameState, {})
            })

            eventManager.subscribe({ types: ['event1'] }, listener1)
            eventManager.subscribe({ types: ['event2'] }, async () => {
                executionOrder.push('event2-handler')
            })
            eventManager.subscribe({ types: ['event3'] }, async () => {
                executionOrder.push('event3-handler')
            })

            await eventManager.emit('event1', gameState, {})

            expect(executionOrder).toEqual(['event1-handler', 'event2-handler', 'event3-handler'])
        })
    })

    describe('Error Handling', () => {
        it('should continue executing listeners even if one throws error', async () => {
            const listener1 = vi.fn(() => {
                throw new Error('Listener 1 error')
            })
            const listener2 = vi.fn()
            const listener3 = vi.fn()

            eventManager.subscribe({ types: ['unit_summoned'] }, listener1)
            eventManager.subscribe({ types: ['unit_summoned'] }, listener2)
            eventManager.subscribe({ types: ['unit_summoned'] }, listener3)

            // Should not throw
            await eventManager.emit('unit_summoned', gameState, {})

            expect(listener1).toHaveBeenCalled()
            expect(listener2).toHaveBeenCalled()
            expect(listener3).toHaveBeenCalled()
        })

        it('should log errors from listeners', async () => {
            const { GameLogger } = await import('@/lib/game_logger')
            const loggerErrorSpy = vi.spyOn(GameLogger, 'error').mockImplementation(() => { })

            const listener = vi.fn(() => {
                throw new Error('Test error')
            })

            eventManager.subscribe({ types: ['turn_start'] }, listener)

            await eventManager.emit('turn_start', gameState, {})

            expect(loggerErrorSpy).toHaveBeenCalled()
            loggerErrorSpy.mockRestore()
        })
    })

    describe('Event Helper Functions', () => {
        beforeEach(() => {
            // Clear the singleton's subscriptions before each test
            singletonEventManager.clearSubscriptions()
            singletonEventManager.clearHistory()
        })

        it('should create card played helper', async () => {
            const helpers = createEventHelpers(gameState)
            const listener = vi.fn()

            // Subscribe to the singleton eventManager (used by helpers)
            singletonEventManager.subscribe({ types: ['card_played'] }, listener)

            await helpers.cardPlayed('card-1', 'Test Card', 3)

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'card_played',
                    data: expect.objectContaining({
                        cardId: 'card-1',
                        cardName: 'Test Card',
                        cost: 3,
                    }),
                })
            )
        })

        it('should create unit summoned helper', async () => {
            const helpers = createEventHelpers(gameState)
            const listener = vi.fn()

            singletonEventManager.subscribe({ types: ['unit_summoned'] }, listener)

            await helpers.unitSummoned('unit-1', 'Knight', 3, 4)

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cardId: 'unit-1',
                        cardName: 'Knight',
                        stats: { attack: 3, health: 4, currentHealth: 4 },
                    }),
                })
            )
        })

        it('should create player loses health helper', async () => {
            const helpers = createEventHelpers(gameState)
            const listener = vi.fn()

            singletonEventManager.subscribe({ types: ['player_loses_health'] }, listener)

            await helpers.playerLosesHealth('player1', 5, 'combat damage')

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        amount: 5,
                        reason: 'combat damage',
                        previousValue: gameState.player1.health,
                        newValue: gameState.player1.health - 5,
                    }),
                })
            )
        })

        it('should create turn start helper', async () => {
            const helpers = createEventHelpers(gameState)
            const listener = vi.fn()

            singletonEventManager.subscribe({ types: ['turn_start'] }, listener)

            await helpers.turnStart('player1')

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'turn_start',
                    data: { playerId: 'player1' },
                })
            )
        })
    })
})
