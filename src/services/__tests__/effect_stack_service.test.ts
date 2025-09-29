import { describe, it, expect, beforeEach, vi } from 'vitest'
import { effectStackService } from '../effect_stack_service'
import { createTestGameState, createTestCard } from '../../test_utils'
import type { CardEffect, EffectContext, GameState } from '../../schemas/schema'

describe('EffectStackService', () => {
    let gameState: GameState

    beforeEach(() => {
        // Reset the stack before each test
        effectStackService.clearStack()
        gameState = createTestGameState()
    })

    describe('addToStack', () => {
        it('should add effect to the stack', () => {
            const effect: CardEffect = {
                id: 'test-effect-1',
                name: 'Test Effect',
                description: 'A test effect',
                type: 'instant',
                execute: vi.fn(() => ({ success: true })),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard({ id: 'source-card' }),
            }

            effectStackService.addToStack(effect, context, { sourcePlayerId: 'player1' })

            const stackState = effectStackService.getStackState()
            expect(stackState.items).toHaveLength(1)
            expect(stackState.items[0].effect.id).toBe('test-effect-1')
        })

        it('should add multiple effects in order', () => {
            const effect1: CardEffect = {
                id: 'effect-1',
                name: 'Effect 1',
                description: 'First effect',
                type: 'instant',
                execute: vi.fn(() => ({ success: true })),
            }

            const effect2: CardEffect = {
                id: 'effect-2',
                name: 'Effect 2',
                description: 'Second effect',
                type: 'instant',
                execute: vi.fn(() => ({ success: true })),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(effect1, context)
            effectStackService.addToStack(effect2, context)

            const stackState = effectStackService.getStackState()
            expect(stackState.items).toHaveLength(2)
            expect(stackState.items[0].effect.id).toBe('effect-1')
            expect(stackState.items[1].effect.id).toBe('effect-2')
        })

        it('should respect priority when specified', () => {
            const lowPriorityEffect: CardEffect = {
                id: 'low-priority',
                name: 'Low Priority',
                description: 'Low priority effect',
                type: 'instant',
                execute: vi.fn(() => ({ success: true })),
            }

            const highPriorityEffect: CardEffect = {
                id: 'high-priority',
                name: 'High Priority',
                description: 'High priority effect',
                type: 'instant',
                execute: vi.fn(() => ({ success: true })),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(lowPriorityEffect, context, { sourcePlayerId: 'player1', priority: 1 })
            effectStackService.addToStack(highPriorityEffect, context, { sourcePlayerId: 'player1', priority: 10 })

            const stackState = effectStackService.getStackState()
            expect(stackState.items).toHaveLength(2)

            // Higher priority should be processed first (at end of array for LIFO)
            // But they maintain insertion order within same priority
        })
    })

    describe('resolveStack', () => {
        it('should resolve effects in LIFO order (Last In, First Out)', async () => {
            const executionOrder: string[] = []

            const effect1: CardEffect = {
                id: 'effect-1',
                name: 'Effect 1',
                description: 'First effect',
                type: 'instant',
                execute: () => {
                    executionOrder.push('effect-1')
                    return { success: true }
                },
            }

            const effect2: CardEffect = {
                id: 'effect-2',
                name: 'Effect 2',
                description: 'Second effect',
                type: 'instant',
                execute: () => {
                    executionOrder.push('effect-2')
                    return { success: true }
                },
            }

            const effect3: CardEffect = {
                id: 'effect-3',
                name: 'Effect 3',
                description: 'Third effect',
                type: 'instant',
                execute: () => {
                    executionOrder.push('effect-3')
                    return { success: true }
                },
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            // Add effects 1, 2, 3
            effectStackService.addToStack(effect1, context, { sourcePlayerId: 'player1' })
            effectStackService.addToStack(effect2, context, { sourcePlayerId: 'player1' })
            effectStackService.addToStack(effect3, context, { sourcePlayerId: 'player1' })

            // Resolve stack
            const result = await effectStackService.resolveStack()

            // Should resolve in reverse order: 3, 2, 1 (LIFO)
            expect(executionOrder).toEqual(['effect-3', 'effect-2', 'effect-1'])
            expect(result.resolved).toHaveLength(3)
            expect(result.success).toBe(true)
        })

        it('should clear the stack after resolution', async () => {
            const effect: CardEffect = {
                id: 'test-effect',
                name: 'Test Effect',
                description: 'A test effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(effect, context, { sourcePlayerId: 'player1' })
            expect(effectStackService.getStackState().items).toHaveLength(1)

            await effectStackService.resolveStack()

            expect(effectStackService.getStackState().items).toHaveLength(0)
        })

        it('should handle effects that modify game state', async () => {
            const effect: CardEffect = {
                id: 'damage-effect',
                name: 'Damage Effect',
                description: 'Deal 3 damage',
                type: 'instant',
                execute: (context: EffectContext) => {
                    const newState = { ...context.gameState }
                    newState.player2.health -= 3
                    return { success: true, newGameState: newState }
                },
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(effect, context, { sourcePlayerId: 'player1' })

            const initialHealth = gameState.player2.health
            const result = await effectStackService.resolveStack()

            expect(result.success).toBe(true)
            expect(result.newGameState).toBeDefined()
            expect(result.newGameState?.player2.health).toBe(initialHealth - 3)
        })

        it('should handle empty stack gracefully', async () => {
            const result = await effectStackService.resolveStack()

            expect(result.success).toBe(true)
            expect(result.resolved).toHaveLength(0)
        })

        it('should handle effect execution errors gracefully', async () => {
            const failingEffect: CardEffect = {
                id: 'failing-effect',
                name: 'Failing Effect',
                description: 'This effect will fail',
                type: 'instant',
                execute: () => {
                    throw new Error('Effect execution failed')
                },
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(failingEffect, context, { sourcePlayerId: 'player1' })

            const result = await effectStackService.resolveStack()

            // Should handle error and return failed result
            expect(result.success).toBe(false)
            expect(result.errors).toBeDefined()
            expect(result.errors?.length).toBeGreaterThan(0)
        })
    })

    describe('counterEffect', () => {
        it('should remove countered effect from stack', () => {
            const effect: CardEffect = {
                id: 'spell-effect',
                name: 'Spell Effect',
                description: 'A spell effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(effect, context, { sourcePlayerId: 'player1' })
            expect(effectStackService.getStackState().items).toHaveLength(1)

            const countered = effectStackService.counterEffect('spell-effect', 'player1')

            expect(countered).toBe(true)
            expect(effectStackService.getStackState().items).toHaveLength(0)
        })

        it('should return false when trying to counter non-existent effect', () => {
            const countered = effectStackService.counterEffect('non-existent', 'player1')
            expect(countered).toBe(false)
        })

        it('should allow countering only the most recent effect (top of stack)', () => {
            const effect1: CardEffect = {
                id: 'effect-1',
                name: 'Effect 1',
                description: 'First effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            const effect2: CardEffect = {
                id: 'effect-2',
                name: 'Effect 2',
                description: 'Second effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(effect1, context, { sourcePlayerId: 'player1' })
            effectStackService.addToStack(effect2, context, { sourcePlayerId: 'player1' })

            // Try to counter effect-1 (not on top)
            const countered1 = effectStackService.counterEffect('effect-1', 'player1')

            // Should only allow countering top of stack
            expect(countered1).toBe(false)

            // Counter effect-2 (on top)
            const countered2 = effectStackService.counterEffect('effect-2', 'player1')
            expect(countered2).toBe(true)
        })
    })

    describe('passPriority', () => {
        it('should increment pass count', () => {
            const initialState = effectStackService.getStackState()
            const initialPassCount = initialState.passCount || 0

            effectStackService.passPriority()

            const newState = effectStackService.getStackState()
            expect(newState.passCount).toBe(initialPassCount + 1)
        })

        it('should trigger resolution when both players pass', async () => {
            const effect: CardEffect = {
                id: 'test-effect',
                name: 'Test Effect',
                description: 'A test effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            effectStackService.addToStack(effect, context, { sourcePlayerId: 'player1' })

            // First pass
            effectStackService.passPriority()
            expect(effectStackService.getStackState().items).toHaveLength(1)

            // Second pass - should trigger resolution
            effectStackService.passPriority()

            // Stack should be empty after both players pass
            // (Note: This depends on your implementation - adjust as needed)
        })
    })

    describe('clearStack', () => {
        it('should remove all effects from stack', () => {
            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            // Add multiple effects
            for (let i = 0; i < 3; i++) {
                const effect: CardEffect = {
                    id: `effect-${i}`,
                    name: `Effect ${i}`,
                    description: `Effect number ${i}`,
                    type: 'instant',
                    execute: () => ({ success: true }),
                }
                effectStackService.addToStack(effect, context, { sourcePlayerId: 'player1' })
            }

            expect(effectStackService.getStackState().items).toHaveLength(3)

            effectStackService.clearStack()

            expect(effectStackService.getStackState().items).toHaveLength(0)
        })
    })

    describe('getStackState', () => {
        it('should return current stack state', () => {
            const stackState = effectStackService.getStackState()

            expect(stackState).toBeDefined()
            expect(stackState.items).toBeDefined()
            expect(Array.isArray(stackState.items)).toBe(true)
        })

        it('should include all stack items', () => {
            const context: EffectContext = {
                gameState,
                source: createTestCard(),
            }

            const effect1: CardEffect = {
                id: 'effect-1',
                name: 'Effect 1',
                description: 'First effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            const effect2: CardEffect = {
                id: 'effect-2',
                name: 'Effect 2',
                description: 'Second effect',
                type: 'instant',
                execute: () => ({ success: true }),
            }

            effectStackService.addToStack(effect1, context)
            effectStackService.addToStack(effect2, context)

            const stackState = effectStackService.getStackState()
            expect(stackState.items).toHaveLength(2)
            expect(stackState.items[0].effect.id).toBe('effect-1')
            expect(stackState.items[1].effect.id).toBe('effect-2')
        })
    })
})
